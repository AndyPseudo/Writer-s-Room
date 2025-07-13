import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings, getContext } from '../../../extensions.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';
import { openai_setting_names, chat_completion_sources } from '../../../../scripts/openai.js';

// Local module imports
import { 
    runWritersRoomPipeline, 
    DEFAULT_STAGE_A_PROMPT,
    DEFAULT_STAGE_B_PROMPT, 
    DEFAULT_SYNTHESIS_PROMPT 
} from './writersroom.js';

// CONFIGURATION AND STATE
const EXTENSION_NAME = "WritersRoom";
const LOG_PREFIX = `[${EXTENSION_NAME}]`;
const EXTENSION_FOLDER_PATH = `scripts/extensions/third-party/Writer-s-Room`;

// NEW: Simple UI Logger Class
class SimpleLogger {
    constructor(prefix, maxSize = 100) {
        this.prefix = prefix;
        this.logs = [];
        this.maxSize = maxSize;
    }

    log(message, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        this.logs.push({ timestamp, message, data: data ? JSON.stringify(data, null, 2) : null });
        if (this.logs.length > this.maxSize) {
            this.logs.shift();
        }
        // Also log to console for power users
        console.log(this.prefix, message, data ?? '');
    }

    show() {
        const logContent = this.logs.length > 0
            ? this.logs.map(entry => 
                `[${entry.timestamp}] ${entry.message}` + (entry.data ? `\n  Data: ${entry.data}` : '')
              ).reverse().join('\n\n')
            : 'No log entries yet.';
        
        const popupContent = document.createElement('div');
        popupContent.innerHTML = `
            <h4>Writer's Room Debug Log</h4>
            <p>Most recent events are at the top.</p>
            <textarea class="text_pole" readonly style="width: 100%; height: 60vh; white-space: pre; font-family: monospace; font-size: 12px; line-height: 1.4;">${logContent}</textarea>
        `;
        callGenericPopup(popupContent, POPUP_TYPE.DISPLAY, 'Debug Log', { wide: true, large: true });
    }
}
const wrLogger = new SimpleLogger(LOG_PREFIX);

// State Variables
let isPipelineRunning = false;
let isAppReady = false;
let readyQueue = [];
let lastPipelineResults = { stageA: null, stageB: null, synthesis: null };

// Default Settings
const defaultSettings = {
    writersRoomEnabled: false,
    stageAEnabled: true,
    stageBEnabled: true,
    synthesisEnabled: true,
    stageAPreset: 'Default',
    stageAApi: 'deepseek',
    stageAModel: 'deepseek-reasoner',
    stageASource: '',
    stageACustomUrl: '',
    stageAPrompt: '',
    stageBPreset: 'Default', 
    stageBApi: 'makersuite',
    stageBModel: 'gemini-2.5-pro',
    stageBSource: '',
    stageBCustomUrl: '',
    stageBPrompt: '',
    synthesisPreset: 'Default',
    synthesisApi: 'deepseek', 
    synthesisModel: 'deepseek-reasoner',
    synthesisSource: '',
    synthesisCustomUrl: '',
    synthesisPrompt: '' // <--- COMMA REMOVED HERE
};

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

// PIPELINE RESULT VIEWER
function addPipelineResultViewButton() {
    const buttonContainer = document.getElementById('wr-chat-buttons-container');
    if (!buttonContainer) return;

    let viewBtn = document.getElementById('wr-view-results-btn');
    if (!viewBtn) {
        viewBtn = document.createElement('button');
        viewBtn.id = 'wr-view-results-btn';
        viewBtn.className = 'menu_button fa-solid fa-microscope';
        viewBtn.title = "View Last Writer's Room Results";
        viewBtn.style.marginLeft = '5px'; // Add spacing
        viewBtn.addEventListener('click', showPipelineResultPopup);
        buttonContainer.appendChild(viewBtn);
    }
    viewBtn.style.display = 'inline-block';
    viewBtn.classList.add('glow');
    setTimeout(() => viewBtn.classList.remove('glow'), 2000);
}

function showPipelineResultPopup() {
    if (!lastPipelineResults.stageA && !lastPipelineResults.stageB && !lastPipelineResults.synthesis) {
        window.toastr.info("No Writer's Room results are available yet.", "Writer's Room");
        return;
    }

    const popupContent = document.createElement('div');
    popupContent.id = 'wr-results-viewer';
    popupContent.innerHTML = `
        <div class="wr-results-tabs">
            <button class="wr-tab-button active" data-tab="stageA">Stage A</button>
            <button class="wr-tab-button" data-tab="stageB">Stage B</button>
            <button class="wr-tab-button" data-tab="synthesis">Synthesis</button>
        </div>
        <div class="wr-results-content">
            <div class="wr-tab-pane active" data-tab="stageA">
                <h4>Stage A Output</h4>
                <pre>${lastPipelineResults.stageA || 'Not run or failed.'}</pre>
            </div>
            <div class="wr-tab-pane" data-tab="stageB">
                <h4>Stage B Output</h4>
                <pre>${lastPipelineResults.stageB || 'Not run or failed.'}</pre>
            </div>
            <div class="wr-tab-pane" data-tab="synthesis">
                <h4>Final Synthesized Output</h4>
                <pre>${lastPipelineResults.synthesis || 'Not run or no final result.'}</pre>
            </div>
        </div>
    `;

    popupContent.querySelectorAll('.wr-tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            popupContent.querySelectorAll('.wr-tab-button, .wr-tab-pane').forEach(el => el.classList.remove('active'));
            button.classList.add('active');
            popupContent.querySelector(`.wr-tab-pane[data-tab="${tabName}"]`).classList.add('active');
        });
    });

    callGenericPopup(popupContent, POPUP_TYPE.DISPLAY, "Writer's Room Results", { wide: true, large: true });
}

// FULLY CORRECTED API POPUP
async function showApiEditorPopup(stage) {
    if (!isAppReady) { 
        window.toastr.info("SillyTavern is still loading, please wait."); 
        return; 
    }
    
    const settings = extension_settings[EXTENSION_NAME];
    const stageUpper = stage.charAt(0).toUpperCase() + stage.slice(1);

    const currentApi = settings[`${stage}Api`] || 'openai';
    const currentModel = settings[`${stage}Model`] || '';
    const currentSource = settings[`${stage}Source`] || '';
    const currentCustomUrl = settings[`${stage}CustomUrl`] || '';

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

    for (const name of Object.values(chat_completion_sources)) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1').trim();
        apiSelect.appendChild(option);
    }
    apiSelect.value = currentApi;

    const populateModels = async (api) => {
        modelSelect.innerHTML = '<option value="">Loading...</option>';
        modelGroup.style.display = 'block';
        customModelGroup.style.display = 'none';
        customUrlGroup.style.display = 'none';
        sourceGroup.style.display = ['openai', 'openrouter', 'custom'].includes(api) ? 'block' : 'none';

        if (api === chat_completion_sources.CUSTOM) {
            modelGroup.style.display = 'none';
            customModelGroup.style.display = 'block';
            customUrlGroup.style.display = 'block';
            modelSelect.innerHTML = '';
            return;
        }

        const sourceSelectorId = API_TO_SELECTOR_MAP[api];
        if (!sourceSelectorId) {
            modelSelect.innerHTML = '<option value="">-- API not supported by this extension --</option>';
            return;
        }
        
        let sourceSelect = null;
        for (let i = 0; i < 50; i++) {
            sourceSelect = document.querySelector(sourceSelectorId);
            if (sourceSelect && sourceSelect.options.length > 1) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!sourceSelect || sourceSelect.options.length <= 1) {
            wrLogger.log(`Could not find or populate source model selector for API: ${api}`);
            modelSelect.innerHTML = '<option value="">-- No models found in main UI --</option>';
            return;
        }

        modelSelect.innerHTML = '';
        Array.from(sourceSelect.childNodes).forEach(node => {
            if(node.tagName === 'OPTION' || node.tagName === 'OPTGROUP') {
                modelSelect.appendChild(node.cloneNode(true));
            }
        });
        modelSelect.value = settings[`${stage}Model`] || '';
    };

    apiSelect.addEventListener('change', () => populateModels(apiSelect.value));
    await populateModels(currentApi);

    customModelInput.value = currentModel;
    customUrlInput.value = currentCustomUrl || mainCustomUrl;
    sourceInput.value = currentSource;

    popupContent.querySelector('#wr-unbind-btn').addEventListener('pointerup', () => {
        apiSelect.value = 'openai';
        populateModels('openai').then(() => {
            modelSelect.value = '';
        });
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
        wrLogger.log(`onUserMessageRendered called before app ready for message ID ${messageId}.`);
        return;
    }
    
    const settings = extension_settings[EXTENSION_NAME];
    const context = getContext();

    if (!settings.writersRoomEnabled || isPipelineRunning) return;
    
    isPipelineRunning = true;
    wrLogger.log("Writer's Room pipeline starting...");
    lastPipelineResults = { stageA: null, stageB: null, synthesis: null };

    try {
        const pipelineResult = await runWritersRoomPipeline();

        if (!pipelineResult || !pipelineResult.final) {
            throw new Error('Pipeline failed to produce a final output.');
        }

        lastPipelineResults.stageA = pipelineResult.stageA;
        lastPipelineResults.stageB = pipelineResult.stageB;
        lastPipelineResults.synthesis = pipelineResult.final;
        wrLogger.log("Pipeline complete.", { results: { stageA: '...', stageB: '...', synthesis: '...' } });

        window.toastr.success("Writer's Room: Pipeline complete! Injecting instruction.", "Writer's Room");
        
        const instructionArg = JSON.stringify(pipelineResult.final);
        const finalScript = `/inject id=writers_room_final position=chat depth=1 ${instructionArg}`;
        
        await context.executeSlashCommands(finalScript);
        addPipelineResultViewButton();

    } catch (error) {
        wrLogger.log("Pipeline execution failed.", { error: error.message });
        window.toastr.error(`Writer's Room pipeline failed: ${error.message}. Generation may proceed without enhancement.`, "Writer's Room Error", {timeOut: 10000});
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
    wrLogger.log(`APP_READY event received. Running ${readyQueue.length} queued tasks.`);
    while (readyQueue.length > 0) {
        const task = readyQueue.shift();
        try { 
            await task(); 
        } catch (error) { 
            wrLogger.log("Error running queued task:", { error: error.message });
        }
    }
    wrLogger.log("Ready queue finished.");
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
        lastPipelineResults = { stageA: null, stageB: null, synthesis: null };
        wrLogger.log("Initializing Writer's Room...");
        
        extension_settings[EXTENSION_NAME] = { ...defaultSettings, ...extension_settings[EXTENSION_NAME] };
        const settings = extension_settings[EXTENSION_NAME];

        const settingsHtml = await fetch(`${EXTENSION_FOLDER_PATH}/settings.html`).then(res => res.text());
        document.getElementById('extensions_settings').insertAdjacentHTML('beforeend', settingsHtml);

        document.getElementById('wr_show_debug_log')?.addEventListener('click', () => wrLogger.show());

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
                getContext().executeSlashCommands('/inject id=writers_room_final remove');
            }
        });

        ['stageA', 'stageB', 'synthesis'].forEach(stage => {
            const toggle = document.getElementById(`wr_${stage}Enabled`);
            toggle.checked = settings[`${stage}Enabled`];
            toggle.addEventListener('change', () => {
                settings[`${stage}Enabled`] = toggle.checked;
                saveSettingsDebounced();
            });
        });

        let buttonContainer = document.getElementById('wr-chat-buttons-container');
        if (!buttonContainer) {
            buttonContainer = document.createElement('div');
            buttonContainer.id = 'wr-chat-buttons-container';
            const sendButtonHolder = document.getElementById('send_but_holder');
            sendButtonHolder?.parentElement?.insertBefore(buttonContainer, sendButtonHolder.nextSibling);
        }
        
        buttonContainer.insertAdjacentHTML('beforeend', 
            `<button id="wr_toggle" class="fa-solid fa-users" title="Toggle Writer's Room Pipeline"></button>`
        );
        
        const wrToggle = document.getElementById('wr_toggle');
        const updateToggleState = () => {
            if (!isAppReady) return;
            wrToggle?.classList.toggle('active', extension_settings[EXTENSION_NAME].writersRoomEnabled);
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
                getContext().executeSlashCommands('/inject id=writers_room_final remove');
            }
        };
        
        wrToggle?.addEventListener('pointerup', toggleWritersRoom);

        queueReadyTask(async () => {
            try {
                await new Promise(resolve => {
                    const check = () => (typeof openai_setting_names !== 'undefined' && Object.keys(openai_setting_names).length > 0) ? resolve() : setTimeout(check, 100);
                    check();
                });

                const presetOptions = ['<option value="Default">Default</option>', 
                    ...Object.keys(openai_setting_names).map(name => `<option value="${name}">${name}</option>`)].join('');
                
                ['stageA', 'stageB', 'synthesis'].forEach(stage => {
                    const presetSelect = document.getElementById(`wr_${stage}Preset`);
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
                    apiBtn?.addEventListener('pointerup', () => showApiEditorPopup(stage));
                    promptBtn?.addEventListener('pointerup', () => showPromptEditorPopup(stage));
                    updateStageApiDisplay(stage);
                });

                updateToggleState();
                updateSettingsVisibility();

                eventSource.makeLast(event_types.USER_MESSAGE_RENDERED, onUserMessageRenderedForWritersRoom);

            } catch (err) {
                wrLogger.log("Error during ready queue setup:", { error: err.message, stack: err.stack });
            }
        });

    } catch (error) {
        console.error(`${LOG_PREFIX} Critical failure during initialization:`, error);
        window.toastr.error("Writer's Room failed to initialize. See console.");
    }
}

$(document).ready(() => {
    eventSource.on(event_types.APP_READY, runReadyQueue);
    setTimeout(initializeExtensionCore, 100);
});
