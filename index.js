import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings, getContext } from '../../../extensions.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';
import { openai_setting_names, chat_completion_sources } from '../../../../scripts/openai.js';

// Local module imports
import { 
    runWritersRoomPipeline, 
    applyWritersRoomEnvironment,
    DEFAULT_STAGE_A_PROMPT,
    DEFAULT_STAGE_B_PROMPT, 
    DEFAULT_SYNTHESIS_PROMPT 
} from './writersroom.js';

// CONFIGURATION AND STATE
export const EXTENSION_NAME = "WritersRoom";
const LOG_PREFIX = `[${EXTENSION_NAME}]`;
const EXTENSION_FOLDER_PATH = `scripts/extensions/third-party/${EXTENSION_NAME}`;

// State Variables
let isPipelineRunning = false;
let isAppReady = false;
let readyQueue = [];

// Default Settings
const defaultSettings = {
    // Writer's Room Pipeline
    writersRoomEnabled: false,
    stageAEnabled: true,
    stageBEnabled: true,
    synthesisEnabled: true,

    // Stage A (Deepseek R1 - Consistent Prose)
    stageAPreset: 'Default',
    stageAApi: 'deepseek',
    stageAModel: 'deepseek-reasoner',
    stageASource: '',
    stageACustomUrl: '',
    stageAPrompt: '',

    // Stage B (Gemini 2.5 Pro - Creative)
    stageBPreset: 'Default', 
    stageBApi: 'makersuite',
    stageBModel: 'gemini-2.5-pro',
    stageBSource: '',
    stageBCustomUrl: '',
    stageBPrompt: '',

    // Synthesis Stage (Deepseek R1 - Combine & Filter)
    synthesisPreset: 'Default',
    synthesisApi: 'deepseek', 
    synthesisModel: 'deepseek-reasoner',
    synthesisSource: '',
    synthesisCustomUrl: '',
    synthesisPrompt: '',
};

// API Management (from ProsePolisher)
const API_TO_SELECTOR_MAP = {
    [chat_completion_sources.OPENAI]: '#model_openai_select',
    [chat_completion_sources.CLAUDE]: '#model_claude_select',
    [chat_completion_sources.MAKERSUITE]: '#model_google_select',
    [chat_completion_sources.VERTEXAI]: '#model_vertexai_select',
    [chat_completion_sources.OPENROUTER]: '#model_openrouter_select',
    [chat_completion_sources.MISTRALAI]: '#model_mistralai_select',
    [chat_completion_sources.GROQ]: '#model_groq_select',
    [chat_completion_sources.COHERE]: '#model_cohere_select',
    [chat_completion_sources.AI21]: '#model_ai21_select',
    [chat_completion_sources.PERPLEXITY]: '#model_perplexity_select',
    [chat_completion_sources.DEEPSEEK]: '#model_deepseek_select',
    [chat_completion_sources.AIMLAPI]: '#model_aimlapi_select',
    [chat_completion_sources.XAI]: '#model_xai_select',
    [chat_completion_sources.ZEROONEAI]: '#model_01ai_select',
    [chat_completion_sources.POLLINATIONS]: '#model_pollinations_select',
    [chat_completion_sources.NANOGPT]: '#model_nanogpt_select',
};

// UI FUNCTIONS
async function showApiEditorPopup(stage) {
    if (!isAppReady) { 
        window.toastr.info("SillyTavern is still loading, please wait."); 
        return; 
    }
    
    const settings = extension_settings[EXTENSION_NAME];
    const stageUpper = stage.charAt(0).toUpperCase() + stage.slice(1);

    // Current settings for this stage
    const currentApi = settings[`${stage}Api`] || 'openai';
    const currentModel = settings[`${stage}Model`] || '';
    const currentSource = settings[`${stage}Source`] || '';
    const currentCustomUrl = settings[`${stage}CustomUrl`] || '';

    // Get main UI's custom URL
    const mainCustomUrlInput = document.getElementById('custom_api_url_text');
    const mainCustomUrl = mainCustomUrlInput ? mainCustomUrlInput.value.trim() : '';

    const popupContent = document.createElement('div');
    popupContent.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <div>
                <label for="wr_popup_api_selector">API Provider:</label>
                <select id="wr_popup_api_selector" class="text_pole"></select>
            </div>
            <div id="wr_popup_model_group">
                <label for="wr_popup_model_selector">Model:</label>
                <select id="wr_popup_model_selector" class="text_pole"></select>
            </div>
            <div id="wr_popup_custom_model_group" style="display: none;">
                <label for="wr_popup_custom_model_input">Custom Model Name:</label>
                <input type="text" id="wr_popup_custom_model_input" class="text_pole" placeholder="e.g., My-Fine-Tune-v1">
            </div>
            <div id="wr_popup_custom_url_group" style="display: none;">
                <label for="wr_popup_custom_url_input">Custom API URL:</label>
                <input type="text" id="wr_popup_custom_url_input" class="text_pole" placeholder="Enter your custom API URL">
            </div>
            <div id="wr_popup_source_group" style="display: none;">
                <label for="wr_popup_source_input">Source (for some OpenAI-compatibles):</label>
                <input type="text" id="wr_popup_source_input" class="text_pole" placeholder="e.g., DeepSeek">
            </div>
        </div>
        <br>
        <button id="wr-unbind-btn" class="menu_button is_dangerous">Clear All</button>
    `;

    const apiSelect = popupContent.querySelector('#wr_popup_api_selector');
    const modelSelect = popupContent.querySelector('#wr_popup_model_selector');
    const modelGroup = popupContent.querySelector('#wr_popup_model_group');
    const customModelGroup = popupContent.querySelector('#wr_popup_custom_model_group');
    const customModelInput = popupContent.querySelector('#wr_popup_custom_model_input');
    const customUrlGroup = popupContent.querySelector('#wr_popup_custom_url_group');
    const customUrlInput = popupContent.querySelector('#wr_popup_custom_url_input');
    const sourceGroup = popupContent.querySelector('#wr_popup_source_group');
    const sourceInput = popupContent.querySelector('#wr_popup_source_input');

    // Populate API Provider dropdown
    for (const name of Object.values(chat_completion_sources)) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1').trim();
        apiSelect.appendChild(option);
    }
    apiSelect.value = currentApi;

    const populateModels = (api) => {
        modelSelect.innerHTML = '';
        let sourceSelect = null;

        if (api === chat_completion_sources.OPENROUTER) {
            sourceSelect = document.querySelector('#model_openrouter_select');
            if (!sourceSelect || sourceSelect.options.length <= 1) {
                sourceSelect = document.querySelector('#openrouter_model');
            }
        } else {
            const sourceSelectorId = API_TO_SELECTOR_MAP[api];
            if (sourceSelectorId) {
                sourceSelect = document.querySelector(sourceSelectorId);
            }
        }

        const isCustom = api === chat_completion_sources.CUSTOM;
        modelGroup.style.display = !isCustom ? 'block' : 'none';
        customModelGroup.style.display = isCustom ? 'block' : 'none';
        customUrlGroup.style.display = isCustom ? 'block' : 'none';
        sourceGroup.style.display = ['openai', 'openrouter', 'custom'].includes(api) ? 'block' : 'none';

        if (sourceSelect) {
            Array.from(sourceSelect.childNodes).forEach(node => {
                modelSelect.appendChild(node.cloneNode(true));
            });
            if (modelSelect.options.length <= 1) {
                modelSelect.innerHTML = '<option value="">-- No models loaded in main UI --</option>';
            }
        } else {
            console.warn(`${LOG_PREFIX} Could not find source model selector for API: ${api}`);
            modelSelect.innerHTML = '<option value="">-- No models found in main UI --</option>';
        }
    };

    populateModels(currentApi);
    apiSelect.addEventListener('change', () => populateModels(apiSelect.value));

    modelSelect.value = currentModel;
    customModelInput.value = currentModel;
    customUrlInput.value = currentCustomUrl || mainCustomUrl;
    sourceInput.value = currentSource;

    popupContent.querySelector('#wr-unbind-btn').addEventListener('pointerup', () => {
        apiSelect.value = 'openai';
        populateModels('openai');
        modelSelect.value = '';
        customModelInput.value = '';
        customUrlInput.value = '';
        sourceInput.value = '';
        window.toastr.info('Cleared inputs. Click "Save" to apply.');
    });

    if (await callGenericPopup(popupContent, POPUP_TYPE.CONFIRM, `Set API/Model for ${stageUpper}`)) {
        const selectedApi = apiSelect.value;
        settings[`${stage}Api`] = selectedApi;

        if (selectedApi === chat_completion_sources.CUSTOM) {
            settings[`${stage}Model`] = customModelInput.value.trim();
            settings[`${stage}CustomUrl`] = customUrlInput.value.trim();
        } else {
            settings[`${stage}Model`] = modelSelect.value;
            settings[`${stage}CustomUrl`] = '';
        }
        settings[`${stage}Source`] = sourceInput.value.trim();

        saveSettingsDebounced();
        updateStageApiDisplay(stage);
        window.toastr.success(`API/Model settings saved for ${stageUpper}.`);
    }
}

function updateStageApiDisplay(stage) {
    if (!isAppReady) return;
    const settings = extension_settings[EXTENSION_NAME];
    const stageUpper = stage.charAt(0).toUpperCase() + stage.slice(1);
    const displayElement = document.getElementById(`wr_${stage}Display`);
    if (displayElement) {
        const api = settings[`${stage}Api`] || 'None';
        const model = settings[`${stage}Model`] || 'Not Set';
        displayElement.textContent = `${api} / ${model}`;
    }
}

async function showPromptEditorPopup(stage) {
    if (!isAppReady) { 
        window.toastr.info("SillyTavern is still loading, please wait."); 
        return; 
    }
    
    const settings = extension_settings[EXTENSION_NAME];
    const stageUpper = stage.charAt(0).toUpperCase() + stage.slice(1);

    let currentPrompt = '';
    let defaultPrompt = '';
    let title = `Edit ${stageUpper} Prompt`;
    
    switch (stage) {
        case 'stageA':
            currentPrompt = settings.stageAPrompt || DEFAULT_STAGE_A_PROMPT;
            defaultPrompt = DEFAULT_STAGE_A_PROMPT;
            title = 'Edit Stage A Prompt (Consistent Prose)';
            break;
        case 'stageB':
            currentPrompt = settings.stageBPrompt || DEFAULT_STAGE_B_PROMPT;
            defaultPrompt = DEFAULT_STAGE_B_PROMPT;
            title = 'Edit Stage B Prompt (Creative)';
            break;
        case 'synthesis':
            currentPrompt = settings.synthesisPrompt || DEFAULT_SYNTHESIS_PROMPT;
            defaultPrompt = DEFAULT_SYNTHESIS_PROMPT;
            title = 'Edit Synthesis Prompt';
            break;
        default:
            window.toastr.error(`Unknown stage for prompt editing: ${stage}`);
            return;
    }

    const popupContent = document.createElement('div');
    popupContent.innerHTML = `
        <div style="margin-bottom: 10px;">
            <textarea id="wr_prompt_editor" class="text_pole" style="min-height: 300px; width: 100%; resize: vertical; box-sizing: border-box;">${currentPrompt}</textarea>
        </div>
        <button id="wr_reset_prompt_btn" class="menu_button">Reset to Default</button>
    `;

    const resetButton = popupContent.querySelector('#wr_reset_prompt_btn');
    resetButton.addEventListener('pointerup', () => {
        popupContent.querySelector('#wr_prompt_editor').value = defaultPrompt;
        window.toastr.info('Prompt reset to default. Click "OK" to save this reset, or "Cancel" to discard.');
    });

    if (await callGenericPopup(popupContent, POPUP_TYPE.CONFIRM, title, { wide: true, large: true, overflowY: 'auto' })) {
        const newPrompt = popupContent.querySelector('#wr_prompt_editor').value;
        const promptKey = `${stage}Prompt`;
        settings[promptKey] = (newPrompt.trim() === defaultPrompt.trim()) ? '' : newPrompt;
        saveSettingsDebounced();
        window.toastr.success(`${stageUpper} prompt saved.`);
    }
}

// PIPELINE EVENT HANDLING
async function onUserMessageRenderedForWritersRoom(messageId) {
    if (!isAppReady) {
        console.warn(`${LOG_PREFIX} onUserMessageRenderedForWritersRoom called before app ready for message ID ${messageId}.`);
        return;
    }
    
    const settings = extension_settings[EXTENSION_NAME];
    const context = getContext();

    if (!settings.writersRoomEnabled || isPipelineRunning) {
        return;
    }
    
    isPipelineRunning = true;

    try {
        console.log(`${LOG_PREFIX} Starting Writer's Room pipeline...`);
        
        const finalInstruction = await runWritersRoomPipeline();
        if (!finalInstruction) {
            throw new Error('Writer\'s Room pipeline failed to produce output.');
        }

        window.toastr.success("Writer's Room: Pipeline complete! Injecting instruction.", "Writer's Room");
        
        // Inject the final instruction
        const instructionArg = JSON.stringify(finalInstruction);
        const finalScript = `/inject id=writers_room_final position=chat depth=1 ${instructionArg}`;
        
        await context.executeSlashCommands(finalScript);

    } catch (error) {
        console.error(`${LOG_PREFIX} Pipeline execution failed:`, error);
        window.toastr.error(`Writer's Room pipeline failed: ${error.message}. Generation may proceed without enhancement.`, "Writer's Room Error");
    } finally {
        isPipelineRunning = false;
        if (context.reloadGenerationSettings) {
            context.reloadGenerationSettings();
        }
    }
}

// APP_READY Management
async function runReadyQueue() {
    isAppReady = true;
    window.isAppReady = true;
    console.log(`${LOG_PREFIX} APP_READY event received. Running queued tasks (${readyQueue.length}).`);
    while (readyQueue.length > 0) {
        const task = readyQueue.shift();
        try { 
            await task(); 
        } catch (error) { 
            console.error(`${LOG_PREFIX} Error running queued task:`, error); 
        }
    }
    console.log(`${LOG_PREFIX} Ready queue finished.`);
}

function queueReadyTask(task) {
    if (isAppReady) {
        task();
    } else {
        readyQueue.push(task);
    }
}

// INITIALIZATION
async function initializeExtensionCore() {
    try {
        console.log(`${LOG_PREFIX} Initializing Writer's Room...`);
        extension_settings[EXTENSION_NAME] = { ...defaultSettings, ...extension_settings[EXTENSION_NAME] };
        const settings = extension_settings[EXTENSION_NAME];

        // Load settings HTML
        const settingsHtml = await fetch(`${EXTENSION_FOLDER_PATH}/settings.html`).then(res => res.text());
        document.getElementById('extensions_settings').insertAdjacentHTML('beforeend', settingsHtml);

        // Bind main toggle
        const enableToggle = document.getElementById('wr_writersRoomEnabled');
        const settingsContainer = document.getElementById('wr_pipeline_settings_container');
        
        const updateSettingsVisibility = () => {
            if (settingsContainer) {
                settingsContainer.style.display = enableToggle.checked ? 'block' : 'none';
            }
        };

        enableToggle.checked = settings.writersRoomEnabled;
        enableToggle.addEventListener('change', () => {
            settings.writersRoomEnabled = enableToggle.checked;
            saveSettingsDebounced();
            updateSettingsVisibility();
            window.toastr.info(`Writer's Room ${settings.writersRoomEnabled ? 'enabled' : 'disabled'}.`);
            
            if (!settings.writersRoomEnabled) {
                const context = getContext();
                context.executeSlashCommands('/inject id=writers_room_final remove');
            }
        });

        // Bind stage toggles
        ['stageA', 'stageB', 'synthesis'].forEach(stage => {
            const toggle = document.getElementById(`wr_${stage}Enabled`);
            const stageUpper = stage.charAt(0).toUpperCase() + stage.slice(1);
            
            toggle.checked = settings[`${stage}Enabled`];
            toggle.addEventListener('change', () => {
                settings[`${stage}Enabled`] = toggle.checked;
                saveSettingsDebounced();
            });
        });

        // Add toggle button to chat interface
        let buttonContainer = document.getElementById('wr-chat-buttons-container');
        if (!buttonContainer) {
            buttonContainer = document.createElement('div');
            buttonContainer.id = 'wr-chat-buttons-container';
            const sendButtonHolder = document.getElementById('send_but_holder');
            const chatBar = document.getElementById('chat_bar');
            if (sendButtonHolder) {
                sendButtonHolder.parentElement?.insertBefore(buttonContainer, sendButtonHolder.nextSibling);
            } else if (chatBar) {
                chatBar.appendChild(buttonContainer);
            } else {
                document.querySelector('.mes_controls')?.appendChild(buttonContainer);
            }
        }
        
        buttonContainer.insertAdjacentHTML('beforeend', 
            `<button id="wr_toggle" class="fa-solid fa-users" title="Toggle Writer's Room Pipeline"></button>`
        );
        
        const wrToggle = document.getElementById('wr_toggle');
        const updateToggleState = () => {
            if (!isAppReady) return;
            const enabled = settings.writersRoomEnabled;
            wrToggle?.classList.toggle('active', enabled);
        };
        
        const toggleWritersRoom = () => {
            if (!isAppReady) { 
                window.toastr.warning("SillyTavern is not fully ready yet."); 
                return; 
            }
            settings.writersRoomEnabled = !settings.writersRoomEnabled;
            saveSettingsDebounced();
            enableToggle.checked = settings.writersRoomEnabled;
            updateToggleState();
            updateSettingsVisibility();
            window.toastr.info(`Writer's Room ${settings.writersRoomEnabled ? 'enabled' : 'disabled'} for next message.`);

            if (!settings.writersRoomEnabled) {
                const context = getContext();
                context.executeSlashCommands('/inject id=writers_room_final remove');
            }
        };
        
        wrToggle?.addEventListener('pointerup', toggleWritersRoom);

        queueReadyTask(async () => {
            try {
                // Wait for OpenAI settings to be available
                await new Promise(resolve => {
                    const checkOpenAISettings = () => {
                        if (typeof openai_setting_names !== 'undefined' && Object.keys(openai_setting_names).length > 0) {
                            resolve();
                        } else {
                            setTimeout(checkOpenAISettings, 100);
                        }
                    };
                    checkOpenAISettings();
                });

                const presetOptions = ['<option value="Default">Default</option>', 
                    ...Object.keys(openai_setting_names).map(name => `<option value="${name}">${name}</option>`)].join('');
                
                // Bind preset selectors and API buttons for each stage
                ['stageA', 'stageB', 'synthesis'].forEach(stage => {
                    const stageUpper = stage.charAt(0).toUpperCase() + stage.slice(1);
                    const presetSelectId = `wr_${stage}Preset`;
                    const presetSelect = document.getElementById(presetSelectId);
                    const apiBtn = document.querySelector(`.wr-select-api-btn[data-stage="${stage}"]`);
                    const promptBtn = document.querySelector(`.wr-edit-prompt-btn[data-stage="${stage}"]`);

                    if (presetSelect) {
                        presetSelect.innerHTML = presetOptions;
                        presetSelect.value = settings[`${stage}Preset`] || 'Default';
                        presetSelect.addEventListener('change', () => {
                            settings[`${stage}Preset`] = presetSelect.value;
                            saveSettingsDebounced();
                        });
                    }

                    if (apiBtn) {
                        apiBtn.addEventListener('pointerup', () => showApiEditorPopup(stage));
                    }

                    if (promptBtn) {
                        promptBtn.addEventListener('pointerup', () => showPromptEditorPopup(stage));
                    }

                    updateStageApiDisplay(stage);
                });

                updateToggleState();
                updateSettingsVisibility();

                // Register event handlers
                eventSource.makeLast(event_types.USER_MESSAGE_RENDERED, (messageId) => onUserMessageRenderedForWritersRoom(messageId));
                eventSource.on(event_types.chat_id_changed, () => {
                    console.log(`${LOG_PREFIX} Chat changed.`);
                });

            } catch (err) {
                console.error(`${LOG_PREFIX} Error during ready queue setup:`, err);
            }
        });

    } catch (error) {
        console.error(`${LOG_PREFIX} Critical failure during initialization:`, error);
        window.toastr.error("Writer's Room failed to initialize. See console.");
    }
}

$(document).ready(() => {
    console.log(`${LOG_PREFIX} Document ready. Starting initialization...`);
    eventSource.on(event_types.APP_READY, runReadyQueue);
    setTimeout(initializeExtensionCore, 100);
});