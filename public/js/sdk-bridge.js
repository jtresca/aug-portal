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
            case 'GET_USER_IDENTITY':
                handleIdentityHandshake(event.source, requestId);
                break;

            case 'AUG_LOG_IN_REQUEST':
                handleLogin(event.source, requestId);
                break;
            
            case 'AUG_PURCHASE_REQUEST':
                handlePurchase(event.source, payload, requestId);
                break;

            case 'EXIT_FULLSCREEN':
                const exitFS = document.exitFullscreen || 
                              document.webkitExitFullscreen || 
                              document.mozCancelFullScreen || 
                              document.msExitFullscreen;
                if (exitFS && (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement)) {
                    exitFS.call(document);
                }
                console.log("[SDK Bridge] Exit Fullscreen requested by game.");
                break;
            default:
                console.warn(`[SDK Bridge] Unhandled message type: ${type}`);
        }
    });

    /**
     * Handle Get User Identity from the game (Secure Handshake)
     */
    async function handleIdentityHandshake(source, requestId) {
        try {
            const response = await fetch('/api/auth/identity-token');
            const data = await response.json();

            if (data.token) {
                console.log('[AUG SDK] Identity Handshake Successful. Token generated.');
                
                // Show the Identity Toast Notification (UI/UX Requirement)
                const toast = document.getElementById('identity-toast');
                const toastName = document.getElementById('toast-user-name');
                const toastAvatar = document.getElementById('toast-user-avatar');

                if (toast && data.user) {
                    // Prevent double-triggering by adding a 5-second cooldown
                    if (window.augToastCooldown) return;
                    window.augToastCooldown = true;
                    setTimeout(() => { window.augToastCooldown = false; }, 5000);

                    // Delay the actual toast reveal by 2.5s for a smoother load experience (as requested)
                    setTimeout(() => {
                        const toastAvatarInitials = document.getElementById('toast-avatar-initials');
                        const displayName = data.user.display_name || 'Portal User';
                        
                        toastName.textContent = displayName;
                        
                        // Initials logic
                        if (toastAvatarInitials) {
                            toastAvatarInitials.textContent = getInitials(displayName);
                        }

                        const handleAvatarSuccess = () => {
                            toastAvatar.classList.remove('hidden');
                            if (toastAvatarInitials) toastAvatarInitials.classList.add('hidden');
                        };

                        const handleAvatarError = () => {
                            toastAvatar.classList.add('hidden');
                            if (toastAvatarInitials) toastAvatarInitials.classList.remove('hidden');
                        };

                        if (data.user.avatar_url) {
                            toastAvatar.src = data.user.avatar_url;
                            toastAvatar.onload = handleAvatarSuccess;
                            toastAvatar.onerror = handleAvatarError;
                        } else {
                            handleAvatarError();
                        }
                        
                        // Trigger animation by adding the 'show' class
                        toast.classList.remove('hidden');
                        toast.classList.remove('show');
                        void toast.offsetWidth; // Force reflow to allow re-animating
                        toast.classList.add('show');
                        
                        // Auto-hide after animation completes (matches @keyframes)
                        setTimeout(() => {
                            toast.classList.add('hidden');
                            toast.classList.remove('show');
                        }, 4500); 
                    }, 1500);
                }

                source.postMessage({
                    type: 'GET_USER_IDENTITY_RESPONSE',
                    payload: { token: data.token },
                    requestId
                }, '*');
            } else {
                console.log('[AUG SDK] Identity token denied. User not logged in.');
                source.postMessage({
                    type: 'GET_USER_IDENTITY_ERROR',
                    payload: { message: 'Authentication required' },
                    requestId
                }, '*');
                
                // Trigger the portal-side login UI if needed
                if (typeof window.toggleSidePanel === 'function') {
                    window.toggleSidePanel(true, 'auth');
                }
            }
        } catch (err) {
            console.error('[AUG SDK] Identity Handshake Error:', err);
            source.postMessage({
                type: 'GET_USER_IDENTITY_ERROR',
                payload: { message: 'Network or Server error' },
                requestId
            }, '*');
        }
    }

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

    /**
     * Helper to get user initials from display name
     */
    function getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }

})();
