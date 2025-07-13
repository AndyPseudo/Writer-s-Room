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
export const DEFAULT_STAGE_A_PROMPT = `[You are a skilled fiction writer focused on consistent, high-quality prose. Your goal is to write a compelling response that demonstrates excellent character consistency, adherence to established lore, and natural narrative flow.

Key principles:
- Maintain strict character consistency with established personality traits and motivations
- Respect all established lore and world-building elements 
- Write with natural, flowing prose that avoids repetitive patterns
- Show character emotions and reactions through actions and dialogue rather than stating them
- Focus on advancing the narrative in a meaningful way
- Avoid echoing or re-narrating what the user just said/did

Write a thoughtful response that continues the story naturally while maintaining the established tone and character voice.]`;

export const DEFAULT_STAGE_B_PROMPT = `[You are an imaginative and creative fiction writer who excels at bringing fresh perspectives and unexpected elements to stories. Your goal is to write an engaging response that introduces creative elements while respecting the established narrative.

Key principles:
- Inject creativity and originality into the scene
- Consider unexpected character reactions or plot developments
- Add vivid sensory details and atmospheric elements
- Explore character emotions and internal conflicts in interesting ways
- Look for opportunities to add depth or intrigue to the narrative
- Maintain character consistency while finding new facets to explore
- Avoid repeating themes or actions from previous responses

Write a creative and engaging response that adds fresh energy to the story while staying true to the characters and world.]`;

export const DEFAULT_SYNTHESIS_PROMPT = `[You are a master editor and fiction writer. You have received two different approaches to continue this story. Your task is to synthesize the best elements from both responses into a single, polished final response.

**Response A (Consistent):**
{{RESPONSE_A}}

**Response B (Creative):**
{{RESPONSE_B}}

Guidelines for synthesis:
- Use Response A's consistent prose style and character adherence as your foundation
- Incorporate the most compelling creative elements from Response B
- Maintain strict character consistency and lore adherence
- Do NOT quote or directly reference the user's previous message
- Focus on moving the story forward naturally
- Blend the responses seamlessly - the final result should read as if written by a single author
- If one response is significantly better, use it as the primary base while incorporating good elements from the other
- Ensure the final response feels cohesive and flows naturally

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
}             const stageBPrompt = settings.stageBPrompt || DEFAULT_STAGE_B_PROMPT;
                const result = await executeGen(stageBPrompt);
                if (!result || !result.trim()) throw new Error("Produced an empty response.");
                console.log('[WritersRoom] Stage B Response:', result.substring(0, 150) + "...");
                return result;
            } catch (error) {
                console.error('[WritersRoom] Stage B failed:', error);
                window.toastr.error(`Stage B failed: ${error.message}`, "Writer's Room", { timeOut: 8000 });
                return Promise.reject(error);
            }
        })());
    }

    // --- Execute Stages and Collect Results ---
    const results = await Promise.allSettled(stagePromises);

    let resultIndex = 0;
    if (settings.stageAEnabled) {
        if (results[resultIndex].status === 'fulfilled') responseA = results[resultIndex].value;
        resultIndex++;
    }
    if (settings.stageBEnabled) {
        if (results[resultIndex].status === 'fulfilled') responseB = results[resultIndex].value;
    }
    
    if (!responseA && !responseB) {
        throw new Error("All active generation stages failed.");
    }

    // --- Synthesis Stage: Combine & Filter ---
    let finalResponse = null;
    if (settings.synthesisEnabled && responseA && responseB) {
        try {
            window.toastr.info("Writer's Room: Synthesizing responses...", "Writer's Room", { timeOut: 5000, preventDuplicates: true });
            if (!await applyWritersRoomEnvironment('synthesis')) throw new Error("Failed to configure environment for Synthesis.");
            const synthesisPromptTemplate = settings.synthesisPrompt || DEFAULT_SYNTHESIS_PROMPT;
            const synthesisPrompt = synthesisPromptTemplate
                .replace(/\{\{RESPONSE_A\}\}/g, responseA)
                .replace(/\{\{RESPONSE_B\}\}/g, responseB);
            
            finalResponse = await executeGen(synthesisPrompt);
            if (!finalResponse || !finalResponse.trim()) {
                console.warn('[WritersRoom] Synthesis produced an empty response, falling back to Stage A.');
                window.toastr.warning("Synthesis was empty, using Stage A's response.", "Writer's Room");
                finalResponse = responseA;
            }
        } catch (error) {
            console.error('[WritersRoom] Synthesis failed:', error);
            window.toastr.error(`Synthesis failed: ${error.message}. Falling back to Stage A.`, "Writer's Room");
            finalResponse = responseA;
        }
    } else {
        finalResponse = responseA || responseB; // Use A if available, otherwise B
    }

    // Return a comprehensive result object
    return {
        final: finalResponse,
        stageA: responseA,
        stageB: responseB,
    };
}