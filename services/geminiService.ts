
import { GoogleGenAI, Type, Chat, LiveSession, LiveServerMessage, Modality } from "@google/genai";
import { MenuItem } from '../types';

if (!process.env.API_KEY) {
    console.warn("API_KEY environment variable not set. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const getChefRecommendation = async (menu: MenuItem[], query: string) => {
    try {
        const menuString = menu.map(item => `${item.name}: ${item.description}`).join('\n');
        const prompt = `You are a helpful chef at "Potato and Friends". A customer is asking for a recommendation. Their query is: "${query}". Based on our menu below, what would you recommend? Also answer any location-based questions if they ask. \n\nMenu:\n${menuString}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleMaps: {} }],
            },
        });

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const mapLinks = groundingChunks
            .filter(chunk => chunk.maps?.uri)
            .map(chunk => ({
                title: chunk.maps.title,
                uri: chunk.maps.uri,
            }));

        return {
            text: response.text,
            mapLinks,
        };
    } catch (error) {
        console.error("Error getting chef recommendation:", error);
        return { text: "Sorry, I'm having trouble thinking of a recommendation right now. Please try again later.", mapLinks: [] };
    }
};

export const getNutritionalInfo = async (item: MenuItem) => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Estimate the nutritional information for a restaurant dish called "${item.name}" with the description: "${item.description}". Provide values for calories, protein (g), carbs (g), and fat (g).`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        calories: { type: Type.NUMBER },
                        protein: { type: Type.NUMBER },
                        carbs: { type: Type.NUMBER },
                        fat: { type: Type.NUMBER },
                    },
                },
            },
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error getting nutritional info:", error);
        return null;
    }
};

export const createChatSession = (): Chat => {
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: 'You are "Sathi", a friendly and helpful AI assistant for the "Potato and Friends" restaurant. Your goal is to help users with their orders and answer questions about the menu. Be cheerful and use potato-related puns where appropriate.',
            tools: [{
                functionDeclarations: [
                    {
                        name: 'addToCart',
                        description: 'Adds one or more items to the user\'s shopping cart.',
                        parameters: {
                            type: Type.OBJECT,
                            properties: {
                                items: {
                                    type: Type.ARRAY,
                                    description: 'An array of items to add to the cart.',
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            itemName: { type: Type.STRING, description: 'The name of the menu item.' },
                                            quantity: { type: Type.INTEGER, description: 'How many of this item to add.' }
                                        },
                                        required: ['itemName', 'quantity']
                                    }
                                }
                            },
                            required: ['items']
                        }
                    },
                    {
                        name: 'viewCart',
                        description: 'Describes the current contents and total of the user\'s shopping cart.',
                        parameters: { type: Type.OBJECT, properties: {} }
                    },
                    {
                        name: 'getRecommendations',
                        description: 'Suggests menu items based on user preferences like "spicy", "vegetarian", etc.',
                        parameters: {
                            type: Type.OBJECT,
                            properties: {
                                preferences: { type: Type.STRING, description: 'A string describing what the user is looking for (e.g., "something not too spicy", "a vegan option").' }
                            },
                            required: ['preferences']
                        }
                    }
                ]
            }]
        }
    });
};

export const createLiveSession = async (
    callbacks: {
        onOpen: () => void;
        onMessage: (message: LiveServerMessage) => Promise<void>;
        onError: (error: ErrorEvent) => void;
        onClose: (event: CloseEvent) => void;
    }
): Promise<LiveSession> => {
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: callbacks.onOpen,
            onmessage: callbacks.onMessage,
            onerror: callbacks.onError,
            onclose: callbacks.onClose,
        },
        config: {
            // FIX: Use Modality.AUDIO enum for responseModalities as per API guidelines.
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            tools: [{
                functionDeclarations: [
                    {
                        name: 'addToCart',
                        description: 'Adds one or more items to the user\'s shopping cart.',
                        parameters: {
                            type: Type.OBJECT,
                            properties: {
                                items: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            itemName: { type: Type.STRING },
                                            quantity: { type: Type.INTEGER }
                                        },
                                        required: ['itemName', 'quantity']
                                    }
                                }
                            },
                            required: ['items']
                        }
                    }
                ]
            }]
        }
    });
};
