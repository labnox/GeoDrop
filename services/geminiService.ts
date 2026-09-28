import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { Message } from '../types';
import { getTranslations, Language } from '../lib/i18n';

/**
 * Generates a conversational summary of nearby landmarks.
 * Uses Gemini API if an API key is present, and seamlessly falls back
 * to an intelligent local accessibility summarizer when offline or unconfigured.
 */
export const generateDiscoverySummary = async (
  messages: Array<Message & { distance: number }>,
  lang: Language
): Promise<string> => {
  if (messages.length === 0) {
    return "";
  }

  const t = getTranslations(lang);
  const apiKey = process.env.API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const landmarksString = messages
        .slice(0, 8)
        .map((m) => {
          const content = m.type === 'text' ? `Content: "${m.text}"` : 'Content: Audio cue';
          return `- Name: "${m.name}", Type: ${m.type}, ${content}, Distance: ${Math.round(m.distance)} meters, Visibility: ${m.visibility}`;
        })
        .join('\n');

      const systemInstruction = t('Ai.system_instruction');
      const contents = t('Ai.user_prompt', { landmarks: landmarksString });

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      const text = response.text;
      if (text && text.trim().length > 0) {
        return text.trim();
      }
    } catch (error) {
      console.warn("Gemini API call failed, using intelligent local summary fallback:", error);
    }
  }

  // Graceful local accessibility summarizer fallback
  const count = messages.length;
  const closest = messages[0];
  const closestDist = Math.round(closest.distance);
  const closestType = closest.type === 'audio' ? 'audio' : 'text';

  const localizedSummaries: Record<Language, string> = {
    en: count === 1
      ? `You have 1 landmark nearby: "${closest.name}" (${closestType}), located ${closestDist} meters away.`
      : `You have ${count} landmarks nearby. The closest is "${closest.name}" (${closestType}) at ${closestDist} meters.`,
    nl: count === 1
      ? `Er is 1 oriëntatiepunt in de buurt: "${closest.name}" (${closestType === 'audio' ? 'audio' : 'tekst'}), op ${closestDist} meter afstand.`
      : `Er zijn ${count} oriëntatiepunten in de buurt. Het dichtstbijzijnde is "${closest.name}" op ${closestDist} meter afstand.`,
    es: count === 1
      ? `Tienes 1 punto de referencia cerca: "${closest.name}" (${closestType === 'audio' ? 'audio' : 'texto'}), a ${closestDist} metros.`
      : `Tienes ${count} puntos de referencia cerca. El más cercano es "${closest.name}" a ${closestDist} metros.`,
    fr: count === 1
      ? `Vous avez 1 repère à proximité : "${closest.name}" (${closestType === 'audio' ? 'audio' : 'texte'}), situé à ${closestDist} mètres.`
      : `Vous avez ${count} repères à proximité. Le plus proche est "${closest.name}" à ${closestDist} mètres.`
  };

  return localizedSummaries[lang] || localizedSummaries.en;
};
