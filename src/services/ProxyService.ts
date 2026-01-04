import { auth } from '../firebase';
import { withRetry, withTimeout, getErrorMessage } from '../utils/errorHandling';

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

    // Wrap in retry logic with timeout
    return await withRetry(
        async () => {
            return await withTimeout(
                async () => {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers,
                        body
                    });

                    if (!response.ok) {
                        const errorText = await response.text();

                        // Parse rate limit info from headers
                        const retryAfter = response.headers.get('Retry-After');
                        const rateLimitReset = response.headers.get('X-RateLimit-Reset');

                        if (response.status === 429) {
                            const waitTime = retryAfter || '60';
                            throw new Error(
                                `Rate Limit Exceeded. נא להמתין ${waitTime} שניות לפני ניסיון נוסף.`
                            );
                        }

                        throw new Error(`AI Request Failed: ${response.status} - ${errorText}`);
                    }

                    return await response.json();
                },
                120000, // 2 minutes timeout
                'הבקשה ארכה זמן רב מדי. נסה שוב.'
            );
        },
        {
            maxRetries: 3,
            initialDelay: 1000,
            backoffMultiplier: 2,
            onRetry: (attempt, error) => {
                console.warn(
                    `[AI Retry] Attempt ${attempt}/3 for ${endpoint}:`,
                    getErrorMessage(error)
                );
            },
            shouldRetry: (error: Error) => {
                const message = error.message.toLowerCase();
                // Don't retry on auth errors or invalid requests
                if (message.includes('401') || message.includes('403') || message.includes('400')) {
                    return false;
                }
                // Retry on network errors, timeouts, and 500s
                return (
                    message.includes('network') ||
                    message.includes('timeout') ||
                    message.includes('500') ||
                    message.includes('econnreset')
                );
            }
        }
    );
};
