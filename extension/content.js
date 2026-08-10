let tooltipContainer = null;
let currentSelection = "";
let currentWordData = null;
let isTooltipOpen = false;

function createTooltip() {
  if (tooltipContainer) return;
  tooltipContainer = document.createElement("div");
  tooltipContainer.id = "vocab-helper-tooltip";
  document.body.appendChild(tooltipContainer);

  // Prevent clicking inside the tooltip from closing it
  tooltipContainer.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });
}

function hideTooltip() {
  if (tooltipContainer) {
    tooltipContainer.classList.remove("visible");
    isTooltipOpen = false;
  }
}

function showTooltip(x, y) {
  createTooltip();
  
  // Ensure it doesn't go off-screen
  const maxLeft = window.innerWidth - 340; // 320 width + padding
  const safeX = Math.min(x, maxLeft);
  
  tooltipContainer.style.left = `${safeX}px`;
  tooltipContainer.style.top = `${y}px`;
  tooltipContainer.classList.add("visible");
  isTooltipOpen = true;
}

document.addEventListener("mouseup", (e) => {
  // If clicking inside tooltip, do nothing
  if (tooltipContainer && tooltipContainer.contains(e.target)) return;

  const selection = window.getSelection();
  const text = selection.toString().trim();

  // Simple heuristic: Only lookup if text is relatively short (e.g. 1-3 words)
  if (text.length > 0 && text.length < 50 && text.split(/\s+/).length <= 4) {
    currentSelection = text;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Position below the selection
    const x = rect.left + window.scrollX;
    const y = rect.bottom + window.scrollY + 10;
    
    showTooltip(x, y);
    renderLookupPrompt();
  } else {
    hideTooltip();
  }
});

function renderLookupPrompt() {
  tooltipContainer.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
      <span style="font-size: 14px; font-weight: 500; color: #1f2937; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Tra từ "${currentSelection}"?</span>
      <button id="vocab-confirm-lookup-btn" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;">Lookup <svg style="display:inline-block; margin-left:2px; margin-bottom:-2px;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
    </div>
  `;

  document.getElementById("vocab-confirm-lookup-btn").addEventListener("click", () => {
    renderLoading();
    chrome.runtime.sendMessage({ action: "lookup", word: currentSelection }, (response) => {
      if (response && response.success) {
        currentWordData = response.data;
        renderContent(currentWordData, currentWordData.isAlreadySaved);
        
        // Only trigger AI enrichment if the word is not already fully saved
        if (!currentWordData.isAlreadySaved) {
          // Render AI loading state at the bottom of the tooltip
          const aiLoadingEl = document.createElement('div');
          aiLoadingEl.id = 'ai-enrich-loading';
          aiLoadingEl.innerHTML = `<span style="display:inline-block; animation: pulse 1.5s infinite;">✨ AI đang phân tích chuyên sâu...</span>`;
          aiLoadingEl.style.cssText = `margin-top: 12px; font-size: 12px; color: #3b82f6; font-weight: 500; text-align: center; padding: 8px; background: #eff6ff; border-radius: 8px;`;
          tooltipContainer.appendChild(aiLoadingEl);

          // Fetch deep AI enrichment
          chrome.runtime.sendMessage({ action: "enrich", word: currentSelection }, (enrichResponse) => {
            if (!isTooltipOpen) return; // Abort update if user closed tooltip
            
            if (enrichResponse && enrichResponse.success) {
              if (!enrichResponse.data.phonetic) delete enrichResponse.data.phonetic;
              currentWordData = { ...currentWordData, ...enrichResponse.data };
              renderContent(currentWordData, true); // true = has AI enriched data
            } else {
              const loadingEl = document.getElementById('ai-enrich-loading');
              if (loadingEl) {
                loadingEl.innerHTML = `<span style="color: #ef4444;">❌ Lỗi tải AI Insights (Kiểm tra lại API Key hoặc Limit)</span>`;
                loadingEl.style.animation = 'none';
              }
            }
          });
        }

      } else {
        renderError();
      }
    });
  });
}

function renderLoading() {
  tooltipContainer.innerHTML = `<div class="vocab-loading">Looking up "${currentSelection}"...</div>`;
}

function renderError() {
  tooltipContainer.innerHTML = `
    <div class="vocab-header">${currentSelection}</div>
    <div class="vocab-text" style="color: #ef4444;">Could not fetch information. You might need to login or configure API keys.</div>
  `;
}

function formatMultilineText(text) {
  if (!text) return "";
  return text.replace(/\\n/g, '<br/>');
}

function renderContent(data, isEnriched = false) {
  const aiSectionStyle = isEnriched ? `background: #f0fdfa; border: 1px solid #ccfbf1; padding: 10px; border-radius: 8px; margin-top: 12px;` : '';

  const formsHtml = data.forms && data.forms.length > 0 
    ? `<div class="vocab-section-title" style="color: #0f766e;">Word Forms (AI)</div>
       <ul style="color: #0d9488; font-size: 13px; margin: 4px 0 0 0; padding-left: 16px; list-style-type: disc;">
         ${data.forms.map(f => `<li style="margin-bottom: 2px;">${f}</li>`).join('')}
       </ul>` 
    : '';

  tooltipContainer.innerHTML = `
    <div class="vocab-header" style="align-items: flex-start;">
      <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;">
        <div style="display: flex; align-items: flex-start; gap: 6px; flex-wrap: wrap;">
          <span style="word-break: break-word;">${data.word}</span>
          ${data.part_of_speech ? `<span style="font-size: 11px; background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; border: 1px solid #c7d2fe; font-weight: 500; white-space: nowrap; margin-top: 3px;">${data.part_of_speech}</span>` : ''}
          <button id="vocab-speak-btn" style="flex-shrink: 0; background: none; border: none; cursor: pointer; padding: 2px; border-radius: 4px; display: flex; align-items: center; justify-content: center; outline: none; margin-top: 2px;" title="Listen to pronunciation">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
        </div>
        ${data.phonetic ? `<span style="font-size: 13px; color: #6b7280; font-weight: normal;">${data.phonetic}</span>` : ''}
        ${data.short_meaning_vi ? `<span style="font-size: 15px; color: #3b82f6; font-weight: 600;">${data.short_meaning_vi}</span>` : ''}
      </div>
      <button class="vocab-save-btn ${data.isAlreadySaved ? 'saved' : ''}" id="vocab-save-btn" style="flex-shrink: 0; margin-top: 2px;" ${data.isAlreadySaved ? 'disabled' : ''}>${data.isAlreadySaved ? 'Saved' : 'Save'}</button>
    </div>
    
    <div class="vocab-section-title">Definition</div>
    <p class="vocab-text" style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">${formatMultilineText(data.definition_en || data.definition)}</p>
    ${data.definition_vi && !isEnriched ? `<p class="vocab-text" style="color: #4b5563; font-style: italic;">${formatMultilineText(data.definition_vi)}</p>` : ''}
    
    ${data.example ? `
    <div class="vocab-section-title">Example</div>
    <p class="vocab-example">"${formatMultilineText(data.example)}"</p>
    ${data.example_translation_vi ? `<p class="vocab-example-translation" style="font-size: 13px; color: #6b7280; font-style: normal; margin-top: 4px;">${formatMultilineText(data.example_translation_vi)}</p>` : ''}
    ` : ''}

    ${isEnriched ? `
    <div style="${aiSectionStyle}">
      <p class="vocab-text" style="color: #0f766e; margin-bottom: 8px;"><strong>✨ AI Insights:</strong></p>
      <div class="vocab-text" style="color: #374151; font-style: italic; margin-bottom: 8px; line-height: 1.5;">${formatMultilineText(data.definition_vi) || ""}</div>
      ${formsHtml}
      ${data.collocations && data.collocations.length > 0 ? `
      <div class="vocab-section-title" style="color: #0f766e; margin-top: 12px;">Collocations (AI)</div>
      <ul style="color: #0d9488; font-size: 13px; margin: 4px 0 0 0; padding-left: 16px; list-style-type: disc;">
         ${data.collocations.map(c => `<li style="margin-bottom: 2px;">${c}</li>`).join('')}
      </ul>
      ` : ''}
    </div>
    ` : ''}
  `;

  const speakBtn = document.getElementById("vocab-speak-btn");
  if (speakBtn) {
    speakBtn.addEventListener("click", () => {
      const utterance = new SpeechSynthesisUtterance(data.word);
      utterance.lang = "en-US"; // Pronounce in English
      window.speechSynthesis.speak(utterance);
    });
  }

  document.getElementById("vocab-save-btn").addEventListener("click", () => {
    const btn = document.getElementById("vocab-save-btn");
    if (btn.disabled) return;
    
    // Send save request
    btn.textContent = "Saving...";
    btn.disabled = true;
    chrome.runtime.sendMessage({ action: "save", data: currentWordData }, (res) => {
      if (res && res.success) {
        btn.textContent = "Saved";
        btn.classList.add("saved");
        currentWordData.isAlreadySaved = true;
      } else {
        btn.textContent = "Error";
        btn.disabled = false;
        alert(res.error || "Failed to save word. Please login in the extension popup.");
      }
    });
  });
}
