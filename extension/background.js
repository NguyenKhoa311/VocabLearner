import { GEMINI_API_KEY_STRING } from './env.js';
const GEMINI_API_KEYS = GEMINI_API_KEY_STRING.split(',').map(k => k.trim()).filter(k => k);
const pendingEnrichments = new Map();

async function fetchFromGeminiWithRotation(prompt) {
  if (GEMINI_API_KEYS.length === 0 || GEMINI_API_KEYS[0] === "YOUR_GEMINI_API_KEY") return null;
  const GOOGLE_MODELS = ["gemini-2.5-flash-lite", "gemini-1.5-flash", "gemini-1.5-flash-8b"];
  
  for (const key of GEMINI_API_KEYS) {
    for (const model of GOOGLE_MODELS) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (res.ok) return res;
        if (res.status === 429) {
          console.warn(`Key ending in ${key.slice(-4)} rate limited. Trying next key.`);
          break; // Try next key
        }
        console.warn(`Model ${model} failed with status ${res.status}. Trying next model.`);
      } catch (e) {
        console.error("Fetch error:", e);
      }
    }
  }
  return null;
}

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "lookup") {
    lookupWord(request.word).then(data => {
      if (data) {
        sendResponse({ success: true, data: data });
      } else {
        sendResponse({ success: false });
      }
    });
    return true; // Keep the message channel open for async response
  }

  if (request.action === "lookup_sentence") {
    lookupSentence(request.word).then(data => {
      if (data) {
        sendResponse({ success: true, data: data });
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  }

  if (request.action === "enrich") {
    enrichWord(request.word).then(data => {
      if (data) {
        sendResponse({ success: true, data: data });
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  }

  if (request.action === "save") {
    // If the word is already saved, don't duplicate it
    if (request.data.isAlreadySaved) {
      sendResponse({ success: true, message: "Already saved" });
      return true;
    }

    // Save immediately with current data
    saveToFirestore(request.data).then(docId => {
      sendResponse({ success: true, docId: docId });
      
      // If data is incomplete (missing AI insights), fetch and update in background
      if (request.data.topic === "Uncategorized" || !request.data.topic) {
        console.log("Background AI enrichment started for saved word:", request.data.word);
        enrichWord(request.data.word).then(enrichData => {
          if (enrichData) {
            updateFirestoreDoc(docId, enrichData).then(() => {
              console.log("Background AI enrichment saved successfully for:", request.data.word);
            }).catch(e => console.error("Background AI save failed:", e));
          }
        });
      }
    }).catch(err => {
      console.error("Save error:", err);
      sendResponse({ success: false, error: err.message });
    });
    return true; 
  }
});

async function getTopicFromGemini(word) {
  const prompt = `Classify the word "${word}" strictly into ONE of these exactly: Technology, Health & Science, Business & Economy, Education, Environment & Nature, Daily Life, Emotions & Psychology, Entertainment & Art, Travel & Culture, Sports. Return ONLY the topic string, nothing else.`;
  try {
    const res = await fetchFromGeminiWithRotation(prompt);
    if (res && res.ok) {
      const data = await res.json();
      const topic = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (topic) return topic.replace(/['"]/g, '');
    }
  } catch (e) {
    console.error("Failed to get topic from Gemini", e);
  }
  return "Uncategorized";
}

async function enrichWord(word) {
  const normalizedWord = word.toLowerCase();
  if (pendingEnrichments.has(normalizedWord)) {
    console.log("Reusing pending AI enrichment for:", word);
    return pendingEnrichments.get(normalizedWord);
  }

  const enrichPromise = _enrichWordCore(word);
  pendingEnrichments.set(normalizedWord, enrichPromise);
  
  try {
    const result = await enrichPromise;
    pendingEnrichments.delete(normalizedWord);
    return result;
  } catch (e) {
    pendingEnrichments.delete(normalizedWord);
    throw e;
  }
}

async function _enrichWordCore(word) {
  if (GEMINI_API_KEYS.length === 0 || GEMINI_API_KEYS[0] === "YOUR_GEMINI_API_KEY") return null;

  const prompt = `You are a vocabulary helper. Analyze the word/phrase: "${word}". 
Return a JSON object strictly following this structure (do not include markdown wrapping, just the JSON string):
{
  "phonetic": "IPA phonetic transcription if available (e.g. /kæt/)",
  "part_of_speech": "The part of speech in Vietnamese (e.g. Danh từ, Động từ, Tính từ)",
  "short_meaning_vi": "Short Vietnamese translation (1-3 words max, e.g. hạt, cố ý)",
  "definition_vi": "Nghĩa tiếng Việt đầy đủ, chính xác và chuyên sâu hơn.",
  "topic": "Classify the word strictly into ONE of these exactly: Technology, Health & Science, Business & Economy, Education, Environment & Nature, Daily Life, Emotions & Psychology, Entertainment & Art, Travel & Culture, Sports",
  "forms": ["noun: ...", "verb: ...", "adjective: ..."],
  "example": "A realistic example sentence in English.",
  "example_translation_vi": "Bản dịch tiếng Việt của câu ví dụ trên.",
  "collocations": ["collocation 1", "collocation 2"]
}`;

  try {
    const res = await fetchFromGeminiWithRotation(prompt);
    if (res && res.ok) {
      const data = await res.json();
      if (data.candidates && data.candidates.length > 0) {
        let rawText = data.candidates[0].content.parts[0].text;
        let textResult = rawText;
        const jsonMatch = textResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          textResult = jsonMatch[0];
        } else {
          textResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        return JSON.parse(textResult);
      }
    }
  } catch (error) {
    console.warn("Failed to parse Gemini output", error);
  }
  return null;
}

async function checkWordInFirestore(word) {
  const FIREBASE_PROJECT_ID = "vocalhelper";
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
  
  const queryData = {
    structuredQuery: {
      from: [{ collectionId: "words" }],
      where: {
        fieldFilter: { field: { fieldPath: "word" }, op: "EQUAL", value: { stringValue: word.toLowerCase() } }
      },
      limit: 1
    }
  };
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryData)
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0 && data[0].document) {
        const doc = data[0].document.fields;
        return {
          isAlreadySaved: true,
          word: doc.word?.stringValue || word,
          phonetic: doc.phonetic?.stringValue || "",
          part_of_speech: doc.part_of_speech?.stringValue || "",
          short_meaning_vi: doc.short_meaning_vi?.stringValue || "",
          definition_en: doc.definition?.stringValue?.split(' / ')[0] || "",
          definition_vi: doc.definition?.stringValue?.split(' / ')[1] || doc.definition?.stringValue || "",
          topic: doc.topic?.stringValue || "Uncategorized",
          example: doc.example?.stringValue || "",
          example_translation_vi: doc.example_translation_vi?.stringValue || "",
          forms: doc.forms?.arrayValue?.values?.map(v => v.stringValue) || [],
          collocations: doc.collocations?.arrayValue?.values?.map(v => v.stringValue) || []
        };
      }
    }
  } catch (e) {
    console.error("Failed to check Firestore", e);
  }
  return null;
}

async function lookupWord(word) {
  // 1. Check if word already exists in Database
  const existingWord = await checkWordInFirestore(word);
  if (existingWord) {
    console.log("Word already exists in database:", word);
    return existingWord;
  }

  // 2. Fast Dictionary Lookup (Sub-second response)
  try {
    const dictPromise = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`).then(r => r.ok ? r.json() : null);
    const transPromise = fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(word)}`).then(r => r.ok ? r.json() : null);
    
    const [dictData, transData] = await Promise.all([dictPromise, transPromise]);
    
    if (dictData && dictData[0] && transData && transData[0] && transData[0][0]) {
      console.log("Fast Dictionary lookup successful for:", word);
      const entry = dictData[0];
      const meaningEn = entry.meanings[0]?.definitions[0]?.definition || "";
      const meaningVi = transData[0][0][0] || "";
      const phonetic = entry.phonetics?.find(p => p.text)?.text || entry.phonetic || "";
      const pos = entry.meanings[0]?.partOfSpeech || "";
      const example = entry.meanings[0]?.definitions[0]?.example || "";
      
      return {
        word: entry.word || word,
        phonetic: phonetic,
        part_of_speech: pos,
        short_meaning_vi: meaningVi.substring(0, 50),
        definition_en: meaningEn,
        definition_vi: meaningVi,
        topic: "Uncategorized", // Will be enriched during save
        example: example,
        forms: [],
        collocations: []
      };
    }
  } catch (e) {
    console.error("Fast dictionary failed, falling back to Gemini API", e);
  }

  // Fallback to Gemini AI if fast dictionary fails (e.g. phrases, idioms)
  console.log("Falling back to Gemini AI lookup for:", word);
  
  if (GEMINI_API_KEYS.length === 0 || GEMINI_API_KEYS[0] === "YOUR_GEMINI_API_KEY") {
    console.warn("Please configure GEMINI_API_KEY in background.js");
    // Fallback Mock Data for demo purposes if no API key
    return {
      word: word,
      definition: "[MOCK] A descriptive meaning of the word.",
      example: `He used the word "${word}" in a sentence.`,
      collocations: ["common " + word, word + " loudly"]
    };
  }

  const prompt = `You are a vocabulary helper. Analyze the word/phrase: "${word}". 
Return a JSON object strictly following this structure (do not include markdown wrapping, just the JSON string):
{
  "word": "${word}",
  "phonetic": "IPA phonetic transcription (e.g. /kæt/)",
  "part_of_speech": "The part of speech in Vietnamese (e.g. Danh từ, Động từ, Tính từ)",
  "short_meaning_vi": "Short Vietnamese translation (1-3 words max, e.g. hạt, cố ý)",
  "definition_en": "Clear and concise definition in English.",
  "definition_vi": "Nghĩa tiếng Việt đầy đủ và chính xác.",
  "topic": "Classify the word strictly into ONE of these exactly: Technology, Health & Science, Business & Economy, Education, Environment & Nature, Daily Life, Emotions & Psychology, Entertainment & Art, Travel & Culture, Sports",
  "forms": ["noun: ...", "verb: ...", "adjective: ..."],
  "example": "A realistic example sentence in English.",
  "collocations": ["collocation 1", "collocation 2"]
}`;

  let rawText = "";
  try {
    const res = await fetchFromGeminiWithRotation(prompt);
    if (res && res.ok) {
      const data = await res.json();
      if (data.candidates && data.candidates.length > 0) {
        rawText = data.candidates[0].content.parts[0].text;
      let textResult = rawText;
      
      // Robust JSON extraction: find the first '{' and last '}'
      const jsonMatch = textResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        textResult = jsonMatch[0];
      } else {
        // Fallback cleanup if regex fails somehow
        textResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
      }
      
      return JSON.parse(textResult);
      }
    }
  } catch (error) {
    console.error("Gemini fallback failed", error);
  }

  console.error("All models failed.");
  return null;
}

async function lookupSentence(sentence) {
  console.log("Looking up as sentence:", sentence);
  if (GEMINI_API_KEYS.length === 0 || GEMINI_API_KEYS[0] === "YOUR_GEMINI_API_KEY") return null;

  const prompt = `You are a vocabulary helper. Analyze the following sentence/phrase: "${sentence}". 
Return a JSON object strictly following this structure (do not include markdown wrapping, just the JSON string):
{
  "isSentence": true,
  "word": "${sentence.replace(/"/g, '\\"')}",
  "short_meaning_vi": "Bản dịch tự nhiên của câu sang tiếng Việt",
  "definition_vi": "Giải thích ngắn gọn cấu trúc hoặc ngữ cảnh của câu (tùy chọn)",
  "extracted_collocations": [
    {
      "collocation": "phrasal verb, idiom, or collocation found in the sentence",
      "meaning_vi": "Nghĩa tiếng Việt của cụm từ",
      "base_form": "Dạng nguyên thể (VD: to make a decision)"
    }
  ]
}`;

  try {
    const res = await fetchFromGeminiWithRotation(prompt);
    if (res && res.ok) {
      const data = await res.json();
      if (data.candidates && data.candidates.length > 0) {
        let textResult = data.candidates[0].content.parts[0].text;
        const jsonMatch = textResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) textResult = jsonMatch[0];
        else textResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(textResult);
      }
    }
  } catch (error) {
    console.error("Gemini sentence lookup failed", error);
  }
  return null;
}

async function saveToFirestore(data) {
  const FIREBASE_PROJECT_ID = "vocalhelper";
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/words`;
  
  const firestoreData = {
    fields: {
      word: { stringValue: data.word },
      phonetic: { stringValue: data.phonetic || "" },
      part_of_speech: { stringValue: data.part_of_speech || "" },
      short_meaning_vi: { stringValue: data.short_meaning_vi || "" },
      definition: { stringValue: `${data.definition_en} / ${data.definition_vi}` },
      example: { stringValue: data.example || "" },
      example_translation_vi: { stringValue: data.example_translation_vi || "" },
      topic: { stringValue: data.topic || "Uncategorized" },
      type: { stringValue: data.type || "word" },
      createdAt: { timestampValue: new Date().toISOString() },
      nextReviewDate: { timestampValue: new Date().toISOString() },
      srsLevel: { integerValue: 0 }
    }
  };
  
  if (data.forms && data.forms.length > 0) {
    firestoreData.fields.forms = {
      arrayValue: {
        values: data.forms.map(f => ({ stringValue: f }))
      }
    };
  }
  
  if (data.collocations && data.collocations.length > 0) {
    firestoreData.fields.collocations = {
      arrayValue: {
        values: data.collocations.map(c => ({ stringValue: c }))
      }
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(firestoreData)
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to save: ${errorText}`);
  }
  const resultData = await res.json();
  const docId = resultData.name.split('/').pop();
  return docId;
}

async function updateFirestoreDoc(docId, enrichData) {
  const FIREBASE_PROJECT_ID = "vocalhelper";
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/words/${docId}?updateMask.fieldPaths=topic&updateMask.fieldPaths=definition&updateMask.fieldPaths=forms&updateMask.fieldPaths=collocations&updateMask.fieldPaths=phonetic`;
  
  // We need to fetch the existing document first to combine the definitions
  const getRes = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/words/${docId}`);
  let existingDefEn = "";
  if (getRes.ok) {
    const existingData = await getRes.json();
    const existingFullDef = existingData.fields.definition.stringValue || "";
    existingDefEn = existingFullDef.split(' / ')[0] || ""; // Attempt to extract English def
  }

  const firestoreData = {
    fields: {
      topic: { stringValue: enrichData.topic || "Uncategorized" },
      definition: { stringValue: `${existingDefEn} / ${enrichData.definition_vi}` },
    }
  };

  if (enrichData.short_meaning_vi) {
    firestoreData.fields.short_meaning_vi = { stringValue: enrichData.short_meaning_vi };
  }

  if (enrichData.example) {
    firestoreData.fields.example = { stringValue: enrichData.example };
  }
  
  if (enrichData.example_translation_vi) {
    firestoreData.fields.example_translation_vi = { stringValue: enrichData.example_translation_vi };
  }

  if (enrichData.phonetic) {
    firestoreData.fields.phonetic = { stringValue: enrichData.phonetic };
  } else {
    // Keep existing phonetic if not provided by AI, achieved by removing it from updateMask
  }

  if (enrichData.forms && enrichData.forms.length > 0) {
    firestoreData.fields.forms = {
      arrayValue: { values: enrichData.forms.map(f => ({ stringValue: f })) }
    };
  }
  
  if (enrichData.collocations && enrichData.collocations.length > 0) {
    firestoreData.fields.collocations = {
      arrayValue: { values: enrichData.collocations.map(c => ({ stringValue: c })) }
    };
  }

  // Adjust updateMask based on what we are actually updating
  let updateUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/words/${docId}?updateMask.fieldPaths=topic&updateMask.fieldPaths=definition`;
  if (enrichData.short_meaning_vi) updateUrl += `&updateMask.fieldPaths=short_meaning_vi`;
  if (enrichData.forms && enrichData.forms.length > 0) updateUrl += `&updateMask.fieldPaths=forms`;
  if (enrichData.collocations && enrichData.collocations.length > 0) updateUrl += `&updateMask.fieldPaths=collocations`;
  if (enrichData.phonetic) updateUrl += `&updateMask.fieldPaths=phonetic`;
  if (enrichData.example) updateUrl += `&updateMask.fieldPaths=example`;
  if (enrichData.example_translation_vi) updateUrl += `&updateMask.fieldPaths=example_translation_vi`;

  const patchRes = await fetch(updateUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(firestoreData)
  });

  if (!patchRes.ok) {
    const errorText = await patchRes.text();
    throw new Error(`Failed to update background AI data: ${errorText}`);
  }
  return true;
}

// --- SRS Notification System ---

chrome.runtime.onInstalled.addListener(() => {
  // Check every 4 hours (240 minutes)
  chrome.alarms.create("srs-review-reminder", { periodInMinutes: 240 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "srs-review-reminder") {
    await checkDueWords();
  }
});

async function checkDueWords() {
  try {
    const FIREBASE_PROJECT_ID = "vocalhelper";
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/words?pageSize=1000`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data.documents) return;
    
    const now = Date.now();
    let dueCount = 0;
    
    for (const doc of data.documents) {
      if (doc.fields && doc.fields.nextReviewDate) {
        let reviewTime = 0;
        if (doc.fields.nextReviewDate.integerValue) {
          reviewTime = parseInt(doc.fields.nextReviewDate.integerValue, 10);
        } else if (doc.fields.nextReviewDate.doubleValue) {
          reviewTime = parseFloat(doc.fields.nextReviewDate.doubleValue);
        } else if (doc.fields.nextReviewDate.timestampValue) {
          reviewTime = new Date(doc.fields.nextReviewDate.timestampValue).getTime();
        }
        
        if (reviewTime <= now) {
          dueCount++;
        }
      } else {
        dueCount++;
      }
    }
    
    if (dueCount > 0) {
      chrome.notifications.create("srs-reminder-notification", {
        type: "basic",
        iconUrl: "icon128.png",
        title: "Đến giờ ôn tập rồi! 🧠",
        message: `Bạn có ${dueCount} thẻ từ vựng đang chờ ôn tập theo thuật toán. Vào ôn ngay cho nóng nhé!`,
        priority: 2,
        requireInteraction: true
      });
    }
  } catch (error) {
    console.error("Error checking due words:", error);
  }
}

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === "srs-reminder-notification") {
    // Open Web App to Review page
    chrome.tabs.create({ url: "http://localhost:5173/review" });
    chrome.notifications.clear(notificationId);
  }
});
