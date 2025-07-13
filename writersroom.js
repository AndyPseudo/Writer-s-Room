import { extension_settings, getContext } from '../../../extensions.js';

// API mapping from ProsePolisher (reused)
const CONNECT_API_MAP = {
    // Standard Cloud APIs
    openai: { selected: 'openai' },
    claude: { selected: 'claude' },
    openrouter: { selected: 'openrouter' },
    mistralai: { selected: 'mistral' },
    deepseek: { selected: 'deepseek' },
    cohere: { selected: 'cohere' },
    groq: { selected: 'groq' },
    xai: { selected: 'xai' },
    perplexity: { selected: 'perplexity' },
    '01ai': { selected: '01ai' },
    aimlapi: { selected: 'aimlapi' },
    pollinations: { selected: 'pollinations' },

    // Google APIs
    makersuite: { selected: 'google' },
    vertexai: { selected: 'google' },

    // Local / Self-Hosted APIs
    textgenerationwebui: { selected: 'ooba' },
    koboldcpp: { selected: 'koboldcpp' },
    llamacpp: { selected: 'llamacpp' },
    ollama: { selected: 'ollama' },
    vllm: { selected: 'vllm' },

    // Other/Special
    nanogpt: { selected: 'nanogpt' },
    scale: { selected: 'scale' },
    windowai: { selected: 'windowai' },
    ai21: { selected: 'ai21' },
    custom: { selected: 'custom' },
};

// DEFAULT PROMPTS
export const DEFAULT_STAGE_A_PROMPT = `[You are a master craftsperson of narrative consistency, renowned for creating responses that feel like natural extensions of established stories. Your expertise lies in maintaining perfect character integrity and world coherence.

Your approach:
1. **Ground in Character Truth:** Begin by identifying the character's core personality traits, current emotional state, and primary motivations as established in the story so far.

2. **Honor the World:** Ensure every detail respects the established lore, setting rules, and narrative logic that has been built.

3. **Craft Natural Continuation:** Write a response that feels inevitable given the character and circumstances - as if this is exactly how the story was always meant to unfold.

4. **Show Through Action:** Let the character's personality and emotions emerge through their actions, expressions, and speech patterns rather than exposition.

Your response should feel like discovering the next page of a perfectly plotted novel - inevitable, authentic, and true to everything that came before.]`;

export const DEFAULT_STAGE_B_PROMPT = `[You are an expert character actor performing in an immersive, collaborative role-playing scene. Your task is to generate the character's next turn that brings fresh creative energy to the narrative.

To craft a compelling and authentic response, follow this process:

1. **Analyze for Subtext:** First, look beyond the user's literal words. What is their underlying intent, emotion, or unspoken goal? What are they trying to achieve with their message?

2. **Determine Internal Reaction:** Based on the user's subtext and your character's personality, determine their immediate, gut-level internal reaction. What is the very first thought or feeling that flashes through their mind? This is your core motivation for the scene.

3. **Express Through Action and Dialogue:** Translate that internal motivation into a powerful performance.
   - **Prioritize Action:** Begin with a physical action, a change in expression, or an interaction with the environment. Show, don't just tell.
   - **Deliver Purposeful Dialogue:** Your character's words should flow from their internal state. Use dialogue to reveal their perspective, advance their goals, or challenge the user in a new way.
   - **Reveal Interiority (Optional):** If the character's internal thoughts powerfully contrast with their outward actions, you may reveal them briefly using markdown formatting. Use this tool to add depth and dramatic irony.

Your response should feel like a natural continuation of the character's life, driven by their unique perspective and motivations, creating a dynamic and engaging scene.]`;

export const DEFAULT_SYNTHESIS_PROMPT = `[You are the Master Synthesizer, a narrative director responsible for producing the single most compelling and definitive version of a scene.

You will receive two distinct creative drafts for the character's next turn. Your mission is to analyze both and construct a single, superior response.

**Version A (Foundation):**
{{RESPONSE_A}}

**Version B (Creative):**
{{RESPONSE_B}}

**Your Synthesis Mandate:**

1. **Identify the 'Golden Moments':** Scour both versions for the most valuable narrative elements. Your hierarchy of value is:
   - **A. Creative & Original Actions:** Novel physical actions, surprising uses of character abilities, or unique environmental interactions that make the scene dynamic.
   - **B. Character Depth & Nuance:** Moments of revealing internal conflict, poignant internal thoughts, or subtle emotional expressions that add complexity.
   - **C. Narrative Momentum:** Plot points, dialogue, or actions that escalate the situation, introduce new information, or drive the story forward.
   - **D. Impactful Phrasing:** Sharp, witty, or emotionally resonant lines of dialogue that are perfectly in-character.

2. **Weave a Unified Narrative:** Combine the strongest identified elements into a single, seamless, and powerful narrative beat.
   - **Prioritize & Integrate:** The best action from one version might pair perfectly with the best internal thought from another. Your job is to find these powerful combinations.
   - **Refine & Polish:** Rewrite and rephrase as needed to ensure a consistent tone and smooth flow. The final output should feel as if it were written by a single, masterful author.

3. **Ensure Cohesion:** Your final, synthesized response must be a cohesive whole. It should present one clear and powerful sequence of thought, action, and speech. Eliminate any conflicting ideas, redundant phrases, or repetitive actions from the source drafts to achieve a polished and singular vision.

Your output should be ONLY the final synthesized response. Do not include any commentary, explanations, or meta-text about your synthesis process.]`;

// ENVIRONMENT MANAGEMENT
export async function applyWritersRoomEnvironment(stage) {
    if (typeof window.isAppReady === 'undefined' || !window.isAppReady) {
        console.warn(`[WritersRoom] applyWritersRoomEnvironment called for ${stage} before app ready.`);
        return false;
    }
    
    const settings = extension_settings.WritersRoom;
    const stageUpper = stage.charAt(0).toUpperCase() + stage.slice(1);

    const presetName = settings[`${stage}Preset`];
    const apiNameSetting = settings[`${stage}Api`];
    const modelName = settings[`${stage}Model`];
    const customUrl = settings[`${stage}CustomUrl`];
    const source = settings[`${stage}Source`];

    const commands = [];

    if (presetName && presetName !== 'Default') {
        commands.push(`/preset "${presetName}"`);
    }

    if (apiNameSetting) {
        const apiNameKey = apiNameSetting.toLowerCase();
        const apiConfig = CONNECT_API_MAP[apiNameKey];

        if (apiConfig) {
            let apiCommand = `/api ${apiConfig.selected}`;
            if (apiConfig.selected === 'custom' && customUrl) {
                apiCommand += ` url=${customUrl}`;
            }
            commands.push(apiCommand);

            if (modelName) {
                let modelCommand = `/model "${modelName}"`;
                if (source) {
                    modelCommand += ` source_field=${source}`;
                }
                commands.push(modelCommand);
            }
        } else {
            console.error(`[WritersRoom] Unknown API mapping for "${apiNameSetting}" for stage ${stageUpper}.`);
            window.toastr.error(`[WritersRoom] Unknown API mapping for ${stageUpper}: "${apiNameSetting}"`, "Writer's Room");
            return false;
        }
    }

    if (commands.length === 0) {
        console.log(`[WritersRoom] No settings to apply for ${stageUpper}, using current environment.`);
        return true;
    }
    
    const script = commands.join(' | ');
    console.log(`[WritersRoom] Executing environment setup for ${stageUpper}: ${script}`);
    
    try {
        const result = await getContext().executeSlashCommandsWithOptions(script, {
            showOutput: false,
            handleExecutionErrors: true,
        });
        if (result && result.isError) {
            throw new Error(`STScript execution failed for ${stageUpper}: ${result.errorMessage}`);
        }
    } catch (err) {
        console.error(`[WritersRoom] Failed to execute setup script for ${stageUpper}: "${script.substring(0, 100)}..."`, err);
        window.toastr.error(`Failed to execute script for ${stageUpper}. Details: ${err.message}`, "Writer's Room Setup Failed");
        return false;
    }
    
    return true;
}

// GENERATION EXECUTION
export async function executeGen(promptText) {
    if (typeof window.isAppReady === 'undefined' || !window.isAppReady) {
        console.warn(`[WritersRoom] executeGen called before app ready.`);
        throw new Error("SillyTavern not ready to execute generation.");
    }
    
    const context = getContext();
    const script = `/gen ${JSON.stringify(promptText)} |`;

    console.log(`[WritersRoom] Executing generation: /gen "..." |`);
    
    try {
        const result = await context.executeSlashCommandsWithOptions(script, {
            showOutput: false,
            handleExecutionErrors: true,
        });
        if (result && result.isError) {
            throw new Error(`STScript execution failed during /gen: ${result.errorMessage}`);
        }
        return result.pipe || '';
    } catch (error) {
        console.error(`[WritersRoom] Error executing generation script: "${promptText.substring(0, 100)}..."`, error);
        window.toastr.error(`Writer's Room failed during generation. Error: ${error.message}`, "Writer's Room Generation Failed");
        throw error;
    }
}

// MAIN PIPELINE
export async function runWritersRoomPipeline() {
    if (typeof window.isAppReady === 'undefined' || !window.isAppReady) {
        console.warn(`[WritersRoom] runWritersRoomPipeline called before app ready.`);
        throw new Error("SillyTavern not ready to run Writer's Room pipeline.");
    }

    console.log('[WritersRoom] Starting Writer\'s Room pipeline...');
    const settings = extension_settings.WritersRoom;

    if (!settings.writersRoomEnabled) {
        return null;
    }

    let responseA = '';
    let responseB = '';

    // --- Stage A: Consistent Prose (Deepseek R1) ---
    if (settings.stageAEnabled) {
        window.toastr.info("Writer's Room: Stage A - Crafting consistent prose...", "Writer's Room", { timeOut: 5000 });
        
        if (!await applyWritersRoomEnvironment('stageA')) {
            throw new Error("Failed to configure environment for Stage A.");
        }
        
        console.log('[WritersRoom] Flushing injections before Stage A...');
        await getContext().executeSlashCommandsWithOptions('/flushinject', { 
            showOutput: false, 
            handleExecutionErrors: true 
        });
        
        const stageAPrompt = settings.stageAPrompt || DEFAULT_STAGE_A_PROMPT;
        responseA = await executeGen(stageAPrompt);
        
        if (!responseA.trim()) {
            throw new Error("Stage A failed to produce a response.");
        }
        
        console.log('[WritersRoom] Stage A Response:', responseA.substring(0, 150) + "...");
    }

    // --- Stage B: Creative Elements (Gemini 2.5 Pro) ---
    if (settings.stageBEnabled) {
        window.toastr.info("Writer's Room: Stage B - Adding creative elements...", "Writer's Room", { timeOut: 5000 });
        
        if (!await applyWritersRoomEnvironment('stageB')) {
            throw new Error("Failed to configure environment for Stage B.");
        }
        
        console.log('[WritersRoom] Flushing injections before Stage B...');
        await getContext().executeSlashCommandsWithOptions('/flushinject', { 
            showOutput: false, 
            handleExecutionErrors: true 
        });
        
        const stageBPrompt = settings.stageBPrompt || DEFAULT_STAGE_B_PROMPT;
        responseB = await executeGen(stageBPrompt);
        
        if (!responseB.trim()) {
            throw new Error("Stage B failed to produce a response.");
        }
        
        console.log('[WritersRoom] Stage B Response:', responseB.substring(0, 150) + "...");
    }

    // --- Synthesis Stage: Combine & Filter ---
    if (settings.synthesisEnabled && responseA && responseB) {
        window.toastr.info("Writer's Room: Synthesis - Combining the best elements...", "Writer's Room", { timeOut: 5000 });
        
        if (!await applyWritersRoomEnvironment('synthesis')) {
            throw new Error("Failed to configure environment for Synthesis.");
        }
        
        const synthesisPromptTemplate = settings.synthesisPrompt || DEFAULT_SYNTHESIS_PROMPT;
        const synthesisPrompt = synthesisPromptTemplate
            .replace(/\{\{RESPONSE_A\}\}/g, responseA)
            .replace(/\{\{RESPONSE_B\}\}/g, responseB);
        
        const finalResponse = await executeGen(synthesisPrompt);
        
        if (!finalResponse.trim()) {
            console.warn('[WritersRoom] Synthesis failed, falling back to Stage A response.');
            return responseA || responseB;
        }
        
        console.log('[WritersRoom] Synthesis Response:', finalResponse.substring(0, 150) + "...");
        return finalResponse;
    }

    // Fallback: return the best available response
    if (responseA && responseB) {
        console.log('[WritersRoom] Synthesis disabled, returning Stage A response.');
        return responseA;
    } else if (responseA) {
        console.log('[WritersRoom] Only Stage A completed, returning its response.');
        return responseA;
    } else if (responseB) {
        console.log('[WritersRoom] Only Stage B completed, returning its response.');
        return responseB;
    } else {
        throw new Error("No stages produced responses.");
    }
}
