/**
 * AUG Bridge SDK (v1.0)
 * High-performance messaging bridge for AUG.moe Merchant-First Portal.
 */

(function() {
    console.log('AUG Bridge SDK initialized.');

    window.addEventListener('message', async (event) => {
        // In production, we would validate event.origin here
        const { type, payload, requestId } = event.data;

        if (!type) return;

        console.log(`[AUG SDK] Received Command: ${type}`, payload);

        switch (type) {
            case 'AUG_LOG_IN_REQUEST':
                handleLogin(event.source, requestId);
                break;
            
            case 'AUG_PURCHASE_REQUEST':
                handlePurchase(event.source, payload, requestId);
                break;

            default:
                console.warn(`[AUG SDK] Unknown command type: ${type}`);
        }
    });

    /**
     * Handle Login Requests from the game
     */
    async function handleLogin(source, requestId) {
        try {
            // Check if user is already authenticated via portal session
            const response = await fetch('/api/me');
            const data = await response.json();

            if (data.user) {
                // User is logged in, send identity back to game
                source.postMessage({
                    type: 'AUG_LOG_IN_SUCCESS',
                    payload: {
                        userId: data.user.id,
                        displayName: data.user.display_name,
                        avatarUrl: data.user.avatar_url
                    },
                    requestId
                }, '*');
            } else {
                // User is not logged in, trigger portal login UI
                console.log('[AUG SDK] User not authenticated. Opening login panel...');
                
                // Assuming existence of global toggleSidePanel from main.js
                if (typeof window.toggleSidePanel === 'function') {
                    window.toggleSidePanel(true, 'auth');
                } else {
                    // Fallback or broadcast event
                    window.dispatchEvent(new CustomEvent('aug-trigger-login'));
                }

                source.postMessage({
                    type: 'AUG_LOG_IN_REQUIRED',
                    requestId
                }, '*');
            }
        } catch (err) {
            source.postMessage({
                type: 'AUG_ERROR',
                payload: { message: 'Authentication check failed.' },
                requestId
            }, '*');
        }
    }

    /**
     * Handle Purchase Requests (IAP)
     */
    async function handlePurchase(source, payload, requestId) {
        console.log('[AUG SDK] Processing Purchase:', payload);

        // 1. Validate Payload (SKU, Amount)
        if (!payload.sku || !payload.amount) {
            return source.postMessage({
                type: 'AUG_PURCHASE_FAILED',
                payload: { reason: 'Invalid SKU or Amount.' },
                requestId
            }, '*');
        }

        try {
            // 2. Log to Database via Backend
            // In a real flow, this would show a confirmation modal first
            const res = await fetch('/api/transactions/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId: 1, // Mocking gameId for the demo/sandbox
                    sku: payload.sku,
                    amount: payload.amount,
                    type: 'iap'
                })
            });

            if (res.ok) {
                const data = await res.json();
                source.postMessage({
                    type: 'AUG_PURCHASE_SUCCESS',
                    payload: data.transaction,
                    requestId
                }, '*');
                console.log('[AUG SDK] Purchase Logged Successfully');
            } else {
                source.postMessage({
                    type: 'AUG_PURCHASE_FAILED',
                    payload: { reason: 'Unauthorized or Server Error' },
                    requestId
                }, '*');
            }
        } catch (err) {
            source.postMessage({
                type: 'AUG_PURCHASE_FAILED',
                payload: { reason: 'Network error.' },
                requestId
            }, '*');
        }
    }

})();
