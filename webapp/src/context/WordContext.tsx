import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface WordData {
  id: string;
  word: string;
  phonetic?: string;
  definition: string;
  definition_en?: string;
  definition_vi?: string;
  part_of_speech?: string;
  short_meaning_vi?: string;
  example: string;
  example_translation_vi?: string;
  topic: string;
  forms?: string[];
  collocations?: string[];
  type?: "word" | "sentence" | "collocation";
  srsLevel: number;
  interval?: number;
  repetition?: number;
  easeFactor?: number;
  nextReviewDate?: number;
}

interface WordContextType {
  words: WordData[];
  loading: boolean;
}

const WordContext = createContext<WordContextType | undefined>(undefined);

export const WordProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [words, setWords] = useState<WordData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, 'words'), orderBy('createdAt', 'asc')), (snapshot) => {
      const fetchedWords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WordData));
      setWords(fetchedWords);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching words in context:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <WordContext.Provider value={{ words, loading }}>
      {children}
    </WordContext.Provider>
  );
};

export const useWords = () => {
  const context = useContext(WordContext);
  if (context === undefined) {
    throw new Error('useWords must be used within a WordProvider');
  }
  return context;
};
