// Configuration & State
let storedKey = localStorage.getItem('gemini_api_key');
let storedVoice = localStorage.getItem('gemini_voice_name') || 'Aoede';

let state = {
    apiKey: storedKey || '',
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

// UI Elements
const irisCore = document.getElementById('irisCore');
const irisText = document.getElementById('irisLogo'); // Mapped to Logo Image now
const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');

// Setup Canvas size
canvas.width = 320;
canvas.height = 320;

function logStatus(msg, isServer = false) {
    const fullMsg = isServer ? "SERVER: " + msg : "STATUS: " + msg;
    if (!state.isConnected && !state.isListening) console.log(fullMsg);
    // Display on screen for debugging
    if (msg.includes("Error") || msg.includes("failure")) {
        irisText.innerText = msg;
        irisText.style.color = 'red';
    }
}

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
        apiKeyInput.value = state.apiKey || '';
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

// Visualizer Logic
function drawHUD() {
    requestAnimationFrame(drawHUD);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const baseRadius = 80;
    const bars = 120;

    let visualData = new Uint8Array(bars);
    if (state.analyser) {
        state.analyser.getByteFrequencyData(visualData);
    }

    let energy = 0;
    for (let i = 0; i < visualData.length; i++) energy += visualData[i];
    energy = (energy / visualData.length) / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Date.now() * 0.0005);

    for (let i = 0; i < bars; i++) {
        const val = visualData[i] * 0.06;
        const angle = (i / bars) * Math.PI * 2;
        const innerR = baseRadius + (Math.sin(angle * 6 + Date.now() * 0.003) * 3);
        const outerR = innerR + val;

        const hue = 180 + (val * 0.3);
        ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${0.4 + (val / 150)})`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
        ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
        ctx.stroke();

        if (val > 80) {
            ctx.beginPath();
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 1;
            const x2 = Math.cos(angle) * outerR;
            const y2 = Math.sin(angle) * outerR;
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 + Math.cos(angle) * 8, y2 + Math.sin(angle) * 8);
            ctx.stroke();
        }
    }
    ctx.restore();

    const pulse = 1 + (energy * 0.01);
    ctx.beginPath();
    ctx.arc(centerX, centerY, 50 * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 212, 255, ${0.1 + (energy / 100)})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (state.isListening) {
        irisText.style.textShadow = `0 0 ${15 + energy}px var(--primary), 0 0 ${5 + energy / 2}px var(--secondary)`;
        irisText.style.color = '#fff';
    } else {
        irisText.style.textShadow = `0 0 10px var(--primary)`;
        irisText.style.color = 'var(--primary)';
    }
}
drawHUD();

// Audio Captured from Mic (16kHz PCM)
async function initAudio() {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
        latencyHint: 'interactive'
    });
    state.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            latency: 0
        }
    });

    const source = state.audioContext.createMediaStreamSource(state.stream);

    // Aggressive buffer size: 1024 (approx 64ms latency)
    state.processor = state.audioContext.createScriptProcessor(1024, 1, 1);

    source.connect(state.processor);
    state.processor.connect(state.audioContext.destination);

    state.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        if (!state.isConnected) return;

        const pcm16 = floatTo16BitPCM(inputData);
        // Optimized Base64 conversion
        const base64Audio = arrayBufferToBase64(pcm16.buffer);

        sendToGemini({
            realtimeInput: {
                mediaChunks: [{
                    data: base64Audio,
                    mimeType: 'audio/pcm;rate=16000'
                }]
            }
        });
    };
}

function floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function connectToGemini() {
    if (!state.apiKey) {
        logStatus("Error: API Key missing. Long-press IRIS to set.");
        return;
    }
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${state.apiKey}`;
    logStatus("Establishing uplink...");
    logStatus("App Version: Manual-Key-Only");
    logStatus(`Key Debug - Prefix: ${state.apiKey.substring(0, 4)}..., Length: ${state.apiKey.length}`);
    state.ws = new WebSocket(url);

    state.ws.onopen = () => {
        logStatus("Uplink active.");
        sendInitialConfig();
    };

    state.ws.onmessage = async (event) => {
        try {
            let textData = event.data;
            if (textData instanceof Blob) textData = await textData.text();
            const response = JSON.parse(textData);
            handleGeminiResponse(response);
        } catch (e) {
            console.error(e);
        }
    };

    state.ws.onclose = (event) => {
        let isError = (event.code !== 1000 && event.code !== 1005);
        let msg = `Connection closed. Code: ${event.code}, Reason: ${event.reason || 'None'}`;
        if (isError) {
            logStatus(msg); // Will trigger UI display if it contains "Error" - need to ensure it does or modify logStatus
            irisText.innerText = msg; // Force display for abnormal close
            irisText.style.color = 'red';
        } else {
            console.log(msg); // Only console for normal close
        }
        stopSession();
    };
    state.ws.onerror = (error) => {
        logStatus(`Connection error: ${error.message || 'Unknown error'}`);
        // Check API key validity without logging it
        const keyStatus = state.apiKey.startsWith('AIza') ? 'Valid-Prefix' : 'Invalid-Prefix';
        logStatus(`API Key Status: ${keyStatus}`);
    };
}

function sendToGemini(payload) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify(payload));
    }
}

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







