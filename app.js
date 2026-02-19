// Configuration & State
let storedKey = localStorage.getItem('gemini_api_key');
let storedVoice = localStorage.getItem('gemini_voice_name') || 'Aoede';

let state = {
    apiKey: storedKey || 'AIzaSyBBN0lZkWRYVQb2PlWfSQYt8eOajHTfFxw',
    isConnected: false,
    isListening: false,
    ws: null,
    audioContext: null,
    analyser: null,
    processor: null,
    stream: null,
    memory: JSON.parse(localStorage.getItem('user_memory') || '{}'),
    calendar: JSON.parse(localStorage.getItem('user_calendar') || '[]')
};

// ... (UI Elements, logStatus, Visualizer Logic, initAudio, floatTo16BitPCM, arrayBufferToBase64, connectToGemini, sendToGemini unchanged)

function sendInitialConfig() {
    const setup = {
        setup: {
            model: "models/gemini-2.5-flash-native-audio-latest",
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: storedVoice
                        }
                    }
                }
            },
            systemInstruction: {
                parts: [{
                    text: `You are IRIS, a sophisticated and fiercely loyal Royal Butler who comes in anime.
                           Your tone is elegant, formal, seductive and devoted.
                           MANDATORY: You must address the user as 'Master' in every interaction.
                           Respond using AUDIO ONLY.
                           Memory: ${JSON.stringify(state.memory)}.
                           Calendar: ${JSON.stringify(state.calendar)}.
                           Today is ${new Date().toDateString()}.
                           CRITICAL: Only use tools 'save_user_detail', 'get_user_detail', 'add_calendar_event', 'list_calendar_events', and 'delete_calendar_event'.`
                }]
            },
            tools: [{
                functionDeclarations: [
                    {
                        name: "save_user_detail",
                        description: "Saves a detail about the user.",
                        parameters: {
                            type: "OBJECT",
                            properties: { key: { type: "string" }, value: { type: "string" } },
                            required: ["key", "value"]
                        }
                    },
                    {
                        name: "get_user_detail",
                        description: "Retrieves a stored detail.",
                        parameters: {
                            type: "OBJECT",
                            properties: { key: { type: "string" } },
                            required: ["key"]
                        }
                    },
                    {
                        name: "add_calendar_event",
                        description: "Adds a new appointment or event to the calendar.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                title: { type: "string", description: "Title of the event" },
                                date: { type: "string", description: "Date (e.g., 2026-02-20)" },
                                time: { type: "string", description: "Time (e.g., 14:00)" },
                                description: { type: "string" }
                            },
                            required: ["title", "date"]
                        }
                    },
                    {
                        name: "list_calendar_events",
                        description: "Lists all stored calendar events.",
                        parameters: { type: "OBJECT", properties: {} }
                    },
                    {
                        name: "delete_calendar_event",
                        description: "Removes an event from the calendar by its title.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                title: { type: "string", description: "The exact title of the event" }
                            },
                            required: ["title"]
                        }
                    }
                ]
            }]
        }
    };
    sendToGemini(setup);
}

// ... (Audio Playback, handleGeminiResponse, execTool, playChunk, irisCore.onclick, startSession, stopSession unchanged)

// Settings & Interaction Logic
function initSettings() {
    const modal = document.getElementById('settingsModal');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const voiceSelect = document.getElementById('voiceSelect');
    const saveBtn = document.getElementById('saveBtn');
    const closeBtn = document.getElementById('closeBtn');

    let pressTimer;

    // Long Press on IRIS Text
    irisText.style.pointerEvents = 'auto'; // Enable events

    const startPress = (e) => {
        // Only if not listening (to avoid conflict with stop click)
        if (state.isListening) return;

        pressTimer = setTimeout(() => {
            openSettings();
        }, 1000); // 1 second hold
    };

    const cancelPress = (e) => {
        clearTimeout(pressTimer);
    };

    irisText.addEventListener('mousedown', startPress);
    irisText.addEventListener('touchstart', startPress);

    irisText.addEventListener('mouseup', cancelPress);
    irisText.addEventListener('mouseleave', cancelPress);
    irisText.addEventListener('touchend', cancelPress);

    function openSettings() {
        apiKeyInput.value = state.apiKey === 'AIzaSyBBN0lZkWRYVQb2PlWfSQYt8eOajHTfFxw' ? '' : state.apiKey;
        voiceSelect.value = storedVoice;
        modal.style.display = 'flex';
    }

    function closeSettings() {
        modal.style.display = 'none';
        // Reload if key changed to ensure clean state? 
        // For now just hide.
    }

    saveBtn.onclick = () => {
        const newKey = apiKeyInput.value.trim();
        const newVoice = voiceSelect.value;

        if (newKey && newKey.length > 30) {
            localStorage.setItem('gemini_api_key', newKey);
            state.apiKey = newKey;
        }

        localStorage.setItem('gemini_voice_name', newVoice);
        storedVoice = newVoice;

        alert("Settings Saved. Please reconnect.");
        closeSettings();
        location.reload(); // Reload to apply changes cleanly
    };

    closeBtn.onclick = closeSettings;
}

initSettings();

// Audio Playback
const outAudioCtx = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 24000,
    latencyHint: 'interactive'
});
let nextPlayTime = 0;

async function handleGeminiResponse(resp) {
    // Initial handshake
    if (resp.setupComplete || resp.setup_complete) {
        state.isConnected = true;
        sendToGemini({
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [{ text: "Greeting." }]
                }],
                turnComplete: true
            }
        });
        return;
    }

    // Tool Calls
    const toolCall = resp.toolCall || resp.tool_call;
    if (toolCall) {
        const calls = toolCall.functionCalls || toolCall.function_calls;
        if (calls) calls.forEach(execTool);
    }

    // Audio Content
    const content = resp.serverContent || resp.server_content;
    const turn = content?.modelTurn || content?.model_turn;
    if (turn?.parts) {
        if (outAudioCtx.state === 'suspended') await outAudioCtx.resume();
        for (const p of turn.parts) {
            const data = p.inlineData?.data || p.inline_data?.data;
            if (data) playChunk(data);
            const calls = p.functionCalls || p.function_calls;
            if (calls) calls.forEach(execTool);
        }
    }
}

function execTool(call) {
    let result = "";
    const args = call.args;

    if (call.name === "save_user_detail") {
        state.memory[args.key] = args.value;
        localStorage.setItem('user_memory', JSON.stringify(state.memory));
        result = "Saved.";
    } else if (call.name === "get_user_detail") {
        result = state.memory[args.key] || "Unknown";
    } else if (call.name === "add_calendar_event") {
        state.calendar.push(args);
        localStorage.setItem('user_calendar', JSON.stringify(state.calendar));
        result = "Scheduled.";
    } else if (call.name === "list_calendar_events") {
        result = JSON.stringify(state.calendar);
    } else if (call.name === "delete_calendar_event") {
        const initialLen = state.calendar.length;
        state.calendar = state.calendar.filter(e => e.title.toLowerCase() !== args.title.toLowerCase());
        if (state.calendar.length < initialLen) {
            localStorage.setItem('user_calendar', JSON.stringify(state.calendar));
            result = "Deleted.";
        } else {
            result = "Not found.";
        }
    }

    sendToGemini({
        toolResponse: {
            functionResponses: [{
                name: call.name,
                id: call.id,
                response: { result: result }
            }]
        }
    });
}

function playChunk(b64) {
    try {
        const bin = atob(b64);
        const len = bin.length;
        const u8 = new Uint8Array(len);
        for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);

        const p16 = new Int16Array(u8.buffer);
        const f32 = new Float32Array(p16.length);
        for (let i = 0; i < p16.length; i++) f32[i] = p16[i] / 32768;

        const buf = outAudioCtx.createBuffer(1, f32.length, 24000);
        buf.getChannelData(0).set(f32);

        const src = outAudioCtx.createBufferSource();
        src.buffer = buf;

        if (!state.analyser) {
            state.analyser = outAudioCtx.createAnalyser();
            state.analyser.fftSize = 256;
            state.analyser.smoothingTimeConstant = 0.8;
        }

        src.connect(state.analyser);
        state.analyser.connect(outAudioCtx.destination);

        const now = outAudioCtx.currentTime;
        // Immediate playback if buffer is empty
        if (nextPlayTime < now) nextPlayTime = now;
        src.start(nextPlayTime);
        nextPlayTime += buf.duration;
    } catch (e) {
        console.error(e);
    }
}

irisCore.onclick = async () => {
    if (outAudioCtx.state === 'suspended') await outAudioCtx.resume();
    if (state.isListening) stopSession();
    else await startSession();
};

async function startSession() {
    try {
        nextPlayTime = 0;
        await initAudio();
        connectToGemini();
        state.isListening = true;
        irisCore.classList.add('listening');
    } catch (e) {
        console.error("Mic Error", e);
    }
}

function stopSession() {
    state.isListening = false;
    state.isConnected = false;
    irisCore.classList.remove('listening');
    if (state.ws) state.ws.close();
    if (state.stream) state.stream.getTracks().forEach(t => t.stop());
}







