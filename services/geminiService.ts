import { GoogleGenAI, Type } from "@google/genai";
import { PhysicsProfile, PerformanceStats } from '../types';

const updatePhysicsDeclaration = {
  name: 'updatePhysics',
  parameters: {
    type: Type.OBJECT,
    description: 'Update the game physics engine parameters. Use this to tune game feel.',
    properties: {
      gravity: { type: Type.NUMBER, description: 'Vertical force (0.5 - 2.0)' },
      runSpeed: { type: Type.NUMBER, description: 'Max horizontal speed (5 - 20)' },
      groundAccel: { type: Type.NUMBER, description: 'Ground acceleration (0.5 - 5.0)' },
      groundDecel: { type: Type.NUMBER, description: 'Ground stopping power (0.5 - 5.0)' },
      airAccel: { type: Type.NUMBER, description: 'Air acceleration (0.1 - 2.0)' },
      jumpForce: { type: Type.NUMBER, description: 'Jump height power (10 - 30)' },
      doubleJumpForce: { type: Type.NUMBER, description: 'Mid-air jump height power (10 - 30)' },
      jumpCutMultiplier: { type: Type.NUMBER, description: 'Variable jump cut (0.1 - 1.0)' },
      coyoteFrames: { type: Type.NUMBER, description: 'Ledge forgiveness frames (0 - 20)' },
      jumpBufferFrames: { type: Type.NUMBER, description: 'Input buffering frames (0 - 20)' },
      dashSpeed: { type: Type.NUMBER, description: 'Dash velocity (15 - 50)' },
      dashDurationFrames: { type: Type.NUMBER, description: 'Length of dash in frames (5 - 20)' },
      wallSlideSpeed: { type: Type.NUMBER, description: 'Max wall slide speed (1 - 10)' },
      attackDurationFrames: { type: Type.NUMBER, description: 'Duration of attack hitbox (5 - 30)' },
      attackCooldownFrames: { type: Type.NUMBER, description: 'Time between attacks (10 - 60)' },
    },
  },
};

export const processGameDirectorCommand = async (
  prompt: string, 
  currentProfile: PhysicsProfile
): Promise<{ text: string; newProfile?: Partial<PhysicsProfile> }> => {
  
  if (!process.env.API_KEY) {
    return { text: "Error: No API Key provided in environment." };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { role: 'user', parts: [{ text: `Current Physics: ${JSON.stringify(currentProfile)}. User Request: ${prompt}` }] }
      ],
      config: {
        systemInstruction: "You are the 'Game Director' for Project YUI. You control the physics engine. Tune the values to achieve specific game feels (e.g., 'floaty', 'heavy', 'snappy').",
        tools: [{ functionDeclarations: [updatePhysicsDeclaration] }],
      }
    });

    const candidate = response.candidates?.[0];
    const textPart = candidate?.content?.parts?.find(p => p.text)?.text || "Processing...";
    
    const functionCallPart = candidate?.content?.parts?.find(p => p.functionCall);

    if (functionCallPart && functionCallPart.functionCall) {
      const fc = functionCallPart.functionCall;
      if (fc.name === 'updatePhysics') {
        const args = fc.args as Partial<PhysicsProfile>;
        return {
          text: textPart + " [Physics Profile Updated]",
          newProfile: args
        };
      }
    }

    return { text: textPart };

  } catch (error) {
    console.error("Gemini Error:", error);
    return { text: "Connection to Foundry Core failed." };
  }
};

export const diagnosePerformance = async (stats: PerformanceStats): Promise<string> => {
    if (!process.env.API_KEY) return "No API Key.";

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ 
                role: 'user', 
                parts: [{ text: `Analyze this game frame snapshot: ${JSON.stringify(stats)}. Is this acceptable for a 60FPS web game?` }] 
            }],
            config: {
                systemInstruction: "You are a Senior Graphics Engineer. Analyze the provided JSON performance stats. Keep it extremely brief (under 30 words).",
            }
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.text || "Diagnostic failed.";
    } catch (e) {
        return "Diagnostic offline.";
    }
};