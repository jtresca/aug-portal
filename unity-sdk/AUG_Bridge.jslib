mergeInto(LibraryManager.library, {
    
    // Function 1: The Identity Handshake
    AUG_RequestIdentity: function() {
        console.log("[AUG Unity] Requesting Identity from Portal...");

        const message = {
            type: 'GET_USER_IDENTITY',
            requestId: 'unity_handshake_' + Date.now()
        };

        // Initialize listener for the secure response if not already done
        if (!window.augSdkInitialized) {
            window.addEventListener('message', function(event) {
                const { type, payload } = event.data;

                if (type === 'GET_USER_IDENTITY_RESPONSE') {
                    if (window.unityInstance) {
                        // Pass token back to Unity script on 'AUG_Manager' GameObject
                        window.unityInstance.SendMessage('AUG_Manager', 'OnIdentityReceived', payload.token);
                    }
                } else if (type === 'GET_USER_IDENTITY_ERROR') {
                    if (window.unityInstance) {
                        window.unityInstance.SendMessage('AUG_Manager', 'OnIdentityError', payload.message);
                    }
                }
            });
            window.augSdkInitialized = true;
        }

        // Send to Parent Portal (AUG.moe)
        if (window.parent && window.parent !== window) {
            window.parent.postMessage(message, "*");
        } else {
            console.warn("[AUG Unity] Game is not inside an AUG iframe.");
        }
    },

    // Function 2: Exit Fullscreen (The "Smart" Exit Button)
    AUG_ExitFullscreen: function() {
        console.log("[AUG Unity] Exit Fullscreen Requested.");
        
        // Notify Parent Portal to exit its own fullscreen mode
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'EXIT_FULLSCREEN' }, "*");
        } else {
            // Standalone Fallback
            if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            } else {
                console.log("[AUG Unity] Document is not in fullscreen mode.");
            }
        }
    }
});
