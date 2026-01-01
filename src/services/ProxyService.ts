import { auth } from '../firebase';

export const callAI = async (endpoint: string, payload: any) => {
    // Determine Environment
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

    // Get Auth Token
    let token = "";
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (isLocal && apiKey) {
        // Local Dev: Use API Key directly for Vite Proxy
        token = apiKey;
    } else if (auth.currentUser) {
        // Prod: Use Firebase ID Token for Cloud Function Proxy
        token = await auth.currentUser.getIdToken();
    }

    // Choose URL Strategy
    // Note: 'endpoint' should NOT start with /v1 if the proxy adds it.
    // Based on inspection, Vite proxy target is .../v1 and Functions proxy adds .../v1.
    // So endpoint should be e.g. "/chat/completions"
    let url = "";

    if (isLocal) {
        // Option B: Direct Proxy via Vite (set up in vite.config.ts)
        // Vite proxy rule: ^/api/openai -> https://api.openai.com/v1
        url = `/api/openai${endpoint}`;
    } else {
        // Production: Call Cloud Function via Firebase Hosting Rewrite
        // Hosting rewrite: /api/openai/** -> openaiProxy
        url = `/api/openai${endpoint}`;
    }

    // console.log(`🔄 ProxyService: Calling ${url}`);

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`
    };

    let body;

    if (payload instanceof FormData) {
        // Browser sets Content-Type to multipart/form-data with boundary automatically
        body = payload;
    } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(payload);
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI Request Failed: ${response.status} - ${errorText}`);
        }

        return await response.json();

    } catch (error) {
        console.error("❌ ProxyService Error:", error);
        throw error;
    }
};
