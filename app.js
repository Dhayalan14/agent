
// Configuration & State
let state = {
    apiKey: 'AIzaSyAvY3lEPlqdEgRl3BnZfm3Z5Ubcdd1a9Tk',
    isConnected: false,
    isListening: false,
    ws: null,
    audioContext: null,
    analyser: null, // This will be dedicated to AI output
    processor: null,
    stream: null,
    sendCount: 0,
    memory: JSON.parse(localStorage.getItem('user_memory') || '{}'),
    calendar: JSON.parse(localStorage.getItem('user_calendar') || '[]')
};

// UI Elements
const irisCore = document.getElementById('irisCore');
const irisText = document.getElementById('irisText');
const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');

// Setup Canvas size
canvas.width = 320;
canvas.height = 320;

function logStatus(msg, isServer = false) {
    console.log(isServer ? "FROM SERVER:" : "[Status]:", msg);
}

// Visualizer Logic (using AnalyserNode for smoothness)
function drawHUD() {
    requestAnimationFrame(drawHUD);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const baseRadius = 80;
    const bars = 120;

    // Use AnalyserNode if available, otherwise fallback
    let visualData = new Uint8Array(bars);
    if (state.analyser) {
        state.analyser.getByteFrequencyData(visualData);
    }

    // Audio reactive intensity for the core pulse
    let energy = 0;
    for (let i = 0; i < visualData.length; i++) energy += visualData[i];
    energy = (energy / visualData.length) / 2; // Normalize

    ctx.save();
    ctx.translate(centerX, centerY);

    const rotation = Date.now() * 0.0005;
    ctx.rotate(rotation);

    for (let i = 0; i < bars; i++) {
        // Frequency data is 0-255. Reduced to 20% (0.06) for a more subtle effect.
        const val = visualData[i] * 0.06;
        const angle = (i / bars) * Math.PI * 2;

        const innerR = baseRadius + (Math.sin(angle * 6 + Date.now() * 0.003) * 3);
        const outerR = innerR + val;

        const x1 = Math.cos(angle) * innerR;
        const y1 = Math.sin(angle) * innerR;
        const x2 = Math.cos(angle) * outerR;
        const y2 = Math.sin(angle) * outerR;

        const hue = 180 + (val * 0.3);
        ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${0.4 + (val / 150)})`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        if (val > 80) { // Highlight sparks
            ctx.beginPath();
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 1;
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 + Math.cos(angle) * 8, y2 + Math.sin(angle) * 8);
            ctx.stroke();
        }
    }
    ctx.restore();

    // Pulse effect
    const pulse = 1 + (energy * 0.01);
    ctx.beginPath();
    ctx.arc(centerX, centerY, 50 * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 212, 255, ${0.1 + (energy / 100)})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center IRIS text glow
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
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = state.audioContext.createMediaStreamSource(state.stream);

    // Processor for the binary stream to Gemini (No visualizer connection here)
    state.processor = state.audioContext.createScriptProcessor(4096, 1, 1);
    source.connect(state.processor);
    state.processor.connect(state.audioContext.destination);

    state.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        if (!state.isConnected) return;

        const pcm16 = floatTo16BitPCM(inputData);
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));

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
    let output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
}

function connectToGemini() {
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${state.apiKey}`;
    logStatus("Establishing uplink...");
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
            console.error("Msg Error:", e);
        }
    };

    state.ws.onclose = (e) => stopSession();
    state.ws.onerror = (err) => logStatus("Connection failure.");
}

function sendToGemini(payload) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify(payload));
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
                            voiceName: "Aoede"
                        }
                    }
                }
            },
            systemInstruction: {
                parts: [{
                    text: `You are IRIS, a sophisticated and fiercely loyal Royal Butler. 
                           Your tone is elegant, formal, and devoted. 
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

// Audio Playback
const outAudioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
let nextPlayTime = 0;

async function handleGeminiResponse(resp) {
    if (resp.setupComplete || resp.setup_complete) {
        state.isConnected = true;

        // Butler Greeting: Speak first
        sendToGemini({
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [{ text: "Greet me as your Master in your butler persona." }]
                }],
                turnComplete: true
            }
        });
        return;
    }

    const toolCall = resp.toolCall || resp.tool_call;
    if (toolCall) {
        const calls = toolCall.functionCalls || toolCall.function_calls;
        if (calls) calls.forEach(execTool);
    }

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
    if (call.name === "save_user_detail") {
        const { key, value } = call.args;
        state.memory[key] = value;
        localStorage.setItem('user_memory', JSON.stringify(state.memory));
        result = `Success: Saved ${key}.`;
    } else if (call.name === "get_user_detail") {
        result = state.memory[call.args.key] || "Unknown";
    } else if (call.name === "add_calendar_event") {
        const ev = {
            title: call.args.title,
            date: call.args.date,
            time: call.args.time || "All day",
            desc: call.args.description || ""
        };
        state.calendar.push(ev);
        localStorage.setItem('user_calendar', JSON.stringify(state.calendar));
        result = `Success: Scheduled ${ev.title}.`;
    } else if (call.name === "list_calendar_events") {
        result = state.calendar.length > 0 ? JSON.stringify(state.calendar) : "Empty.";
    } else if (call.name === "delete_calendar_event") {
        const len = state.calendar.length;
        state.calendar = state.calendar.filter(e => e.title.toLowerCase() !== call.args.title.toLowerCase());
        if (state.calendar.length < len) {
            localStorage.setItem('user_calendar', JSON.stringify(state.calendar));
            result = `Deleted.`;
        } else {
            result = `Not found.`;
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
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const p16 = new Int16Array(u8.buffer);
        const f32 = new Float32Array(p16.length);
        for (let i = 0; i < p16.length; i++) f32[i] = p16[i] / 32768;

        const buf = outAudioCtx.createBuffer(1, f32.length, 24000);
        buf.getChannelData(0).set(f32);
        const src = outAudioCtx.createBufferSource();
        src.buffer = buf;

        // Persistent Analyser for AI output
        if (!state.analyser) {
            state.analyser = outAudioCtx.createAnalyser();
            state.analyser.fftSize = 256;
            state.analyser.smoothingTimeConstant = 0.8;
        }

        src.connect(state.analyser);
        state.analyser.connect(outAudioCtx.destination);

        const now = outAudioCtx.currentTime;
        if (nextPlayTime < now) nextPlayTime = now;
        src.start(nextPlayTime);
        nextPlayTime += buf.duration;
    } catch (e) { console.error(e); }
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
    }
}

function stopSession() {
    state.isListening = false;
    state.isConnected = false;
    irisCore.classList.remove('listening');
    if (state.ws) state.ws.close();
    if (state.stream) state.stream.getTracks().forEach(t => t.stop());
}
