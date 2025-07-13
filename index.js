/* Writer's Room Extension Styles */

/* Main Settings Container */
.writers-room-settings .inline-drawer-content small {
    display: block;
    margin-top: 2px;
    color: var(--text_color_dim);
}

.writers-room-settings .menu_button {
    margin: 5px 0;
}

/* Custom Header Style */
.writers-room-settings .inline-drawer-toggle.inline-drawer-header {
    background-color: var(--nemo-secondary-bg, #2a2a2a);
    border: 1px solid var(--nemo-border-color, #444);
    border-left: 4px solid #4CAF50; /* Green accent for Writer's Room */
    padding-left: 12px;
    transition: background-color 0.2s ease;
}

.writers-room-settings .inline-drawer-toggle.inline-drawer-header:hover {
    background-color: var(--nemo-item-hover-bg, #333);
}

/* Settings Group Box */
.wr-settings-group-box {
    background-color: var(--nemo-primary-bg-sub, #1e1e1e);
    border: 1px solid var(--nemo-border-color, #444);
    border-radius: 8px;
    padding: 15px;
    margin-top: 10px;
}

/* Stage Configuration Blocks */
.wr-stage-config {
    margin-bottom: 15px;
    padding: 10px;
    background-color: var(--nemo-secondary-bg, #2a2a2a);
    border-radius: 6px;
    border: 1px solid var(--nemo-border-color, #444);
}

.wr-stage-config:last-child {
    margin-bottom: 0;
}

.wr-stage-config > label {
    font-weight: bold;
    display: block;
    margin-bottom: 5px;
}

/* API Display Labels */
.wr-api-display {
    font-weight: normal;
    font-size: 0.9em;
    color: var(--nemo-text-muted, #999);
    background-color: var(--nemo-tertiary-bg, #1e1e1e);
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 5px;
    display: inline-block;
    max-width: 250px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
}

/* Controls Wrapper */
.wr-controls-wrapper {
    display: flex;
    align-items: center;
    gap: 5px;
}

.wr-controls-wrapper > .text_pole, 
.wr-controls-wrapper > select {
    flex-grow: 1;
    min-width: 0;
}

.wr-controls-wrapper > .menu_button {
    flex-shrink: 0;
}

/* Toggle Button in Chat Input */
#wr_toggle {
    margin-left: 10px;
    font-size: 1.2em;
    padding: 5px 10px;
    background-color: var(--nemo-color-bg-dark-gray, #222);
    border: 1px solid var(--nemo-border-color, #444);
    color: var(--nemo-text-muted, #999);
    transition: all 0.2s ease-in-out;
    border-radius: 6px;
}

#wr_toggle.active {
    color: white;
    background-color: #4CAF50; /* Green for Writer's Room */
    border-color: #4CAF50;
    box-shadow: 0 0 8px #4CAF50;
}

/* Usage Information Section */
.wr-usage-info {
    background-color: var(--nemo-tertiary-bg, #1e1e1e);
    border: 1px solid var(--nemo-border-color, #444);
    border-radius: 6px;
    padding: 15px;
    margin-top: 10px;
}

.wr-usage-info h4 {
    margin-top: 0;
    margin-bottom: 10px;
    color: #4CAF50;
}

.wr-usage-info ol {
    margin-bottom: 10px;
    padding-left: 20px;
}

.wr-usage-info li {
    margin-bottom: 5px;
}

.wr-usage-info p {
    margin-bottom: 0;
    font-style: italic;
    color: var(--nemo-text-muted, #999);
}

/* Form styling consistency */
.writers-room-settings .form-group {
    margin: 15px 0;
}

.writers-room-settings .checkbox_label {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    cursor: pointer;
}

.writers-room-settings .checkbox_label input[type="checkbox"] {
    margin-top: 2px;
    flex-shrink: 0;
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .wr-controls-wrapper {
        flex-direction: column;
        align-items: stretch;
    }
    
    .wr-controls-wrapper > .text_pole,
    .wr-controls-wrapper > select,
    .wr-controls-wrapper > .menu_button {
        width: 100%;
        margin-bottom: 5px;
    }
    
    .wr-api-display {
        max-width: 200px;
    }
}

/* Stage-specific color coding (subtle) */
.wr-stage-config { border-left: 3px solid transparent; }
.wr-stage-config:nth-of-type(1) { border-left-color: #2196F3; }
.wr-stage-config:nth-of-type(2) { border-left-color: #FF9800; }
.wr-stage-config:nth-of-type(3) { border-left-color: #9C27B0; }


/* NEW: Result Viewer Styles */
#wr-view-results-btn {
    margin-left: 5px;
    display: none; /* Hidden by default, shown via JS */
}
#wr-view-results-btn.glow {
    animation: wr-glow-anim 1s 2;
}
@keyframes wr-glow-anim {
    0%, 100% { box-shadow: 0 0 5px var(--nemo-color-interactive); }
    50% { box-shadow: 0 0 15px var(--nemo-color-interactive); }
}

#wr-results-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
}
.wr-results-tabs {
    display: flex;
    border-bottom: 1px solid var(--nemo-border-color);
    flex-shrink: 0;
}
.wr-tab-button {
    padding: 10px 15px;
    border: none;
    background: transparent;
    color: var(--text_color_dim);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    font-size: 1em;
}
.wr-tab-button.active {
    color: var(--text_color);
    border-bottom-color: var(--nemo-color-interactive);
}
.wr-results-content {
    flex-grow: 1;
    background-color: var(--nemo-primary-bg-sub);
    overflow-y: auto;
}
.wr-tab-pane {
    display: none;
    padding: 15px;
}
.wr-tab-pane.active {
    display: block;
}
.wr-tab-pane h4 {
    margin-top: 0;
    color: var(--nemo-color-interactive);
}
.wr-tab-pane pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    background-color: var(--nemo-tertiary-bg);
    padding: 10px;
    border-radius: 6px;
    border: 1px solid var(--nemo-border-color);
    max-height: 60vh;
    overflow-y: auto;
    font-size: 0.9em;
}
