import { GoogleGenAI, Type, Chat, LiveSession, LiveServerMessage, Modality, OperationsGetVideosOperationResponse } from "@google/genai";
import { MenuItem } from '../types';

// The API key is injected by the execution environment (e.g., AI Studio).
// The user will be prompted to select a key if one is not available, especially for Veo.
const API_KEY = process.env.API_KEY;

const ai = new GoogleGenAI({ apiKey: API_KEY });

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

export const generateVideoPrompt = async (item: MenuItem): Promise<string> => {
    try {
        const prompt = `Create a short, exciting, and visually descriptive prompt for a 10-second social media video ad for a food item. The prompt should be suitable for an AI video generation model.

        Food Item Name: ${item.name}
        Description: ${item.description}

        Example Prompts:
        - "A cinematic slow-motion shot of golden, crispy fries being drenched in rich, melted cheese sauce, with steam rising."
        - "A vibrant, fast-paced montage of fresh jalapeños being sliced, chili simmering, and then poured over a mountain of fries."

        Generate a new prompt for the given food item.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error generating video prompt:", error);
        return `A delicious-looking video of ${item.name}.`; // Fallback prompt
    }
};


export const generateVideoAd = async (prompt: string): Promise<OperationsGetVideosOperationResponse | null> => {
    try {
        // Create a new instance right before the call to ensure the latest API key is used.
        const veoAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

        let operation = await veoAI.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '9:16' // Portrait for social media
            }
        });

        while (!operation.done) {
            // Wait for 10 seconds before polling again
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await veoAI.operations.getVideosOperation({ operation: operation });
        }

        return operation;

    } catch (error) {
        console.error("Error generating video ad:", error);
        // Special handling for API key not found error
        if (error instanceof Error && error.message.includes("Requested entity was not found.")) {
             throw new Error("API key error. Please select a valid API key.");
        }
        return null;
    }
};