document.addEventListener('DOMContentLoaded', () => {
    const gameGrid = document.getElementById('game-grid');
    const gameModal = document.getElementById('game-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const gameFrame = document.getElementById('game-frame');
    const modalGameTitle = document.getElementById('modal-game-title');
    const loadingState = document.getElementById('loading');
    const errorState = document.getElementById('error-message');

    // 1. Fetch Games from API
    async function fetchGames() {
        try {
            loadingState.classList.remove('hidden');
            
            const response = await fetch('/api/games');
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.games && data.games.length > 0) {
                allGames = data.games; // Cache for search
                renderGames(data.games);
            } else {
                gameGrid.insertAdjacentHTML('beforeend', '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">No games available yet. Check back soon!</p>');
            }
        } catch (error) {
            console.error('Failed to fetch games:', error);
            errorState.textContent = 'Failed to load games. Please try again later.';
            errorState.classList.remove('hidden');
        } finally {
            loadingState.classList.add('hidden');
        }
    }

    // 2. Render Game Tiles densely
    function renderGames(games) {
        // Clear old dynamic tiles, but keep the hardcoded .header-tile!
        gameGrid.querySelectorAll('.dynamic-tile').forEach(t => t.remove());
        
        games.forEach((game, index) => {
            const tile = document.createElement('div');
            
            // Assign sizes dynamically based on the new square grid rules.
            // Introduce some pseudorandomness based on index or just general distribution
            let sizeClass = 'tile-small';
            
            // Ensure we have some large and mediums distributed nicely,
            // but keep the bottom two rows (roughly indexes 135+) strictly small tiles.
            if (index === 0 || index === 28 || index === 95) { 
                // A few highly popular ones get 3x3, pushed one further down
                sizeClass = 'tile-large';
            } else if ([3, 7, 18, 30, 42, 55, 70, 85, 110, 125].includes(index)) {
                // Scatter medium games further down the overall grid
                sizeClass = 'tile-medium';
            }
            
            // Note: Add 'dynamic-tile' class so it can be cleared on re-renders
            tile.className = `game-tile dynamic-tile ${sizeClass}`;
            
            const thumbUrl = game.thumbnail_url || 'https://via.placeholder.com/400x400/1e293b/f8fafc?text=Missing+Thumbnail';
            
            // Refactored to avoid innerHTML for TrustedHTML compatibility
            const img = document.createElement('img');
            img.src = thumbUrl;
            img.alt = game.title;
            img.className = 'game-thumbnail';
            img.loading = 'lazy';
            tile.appendChild(img);

            const overlay = document.createElement('div');
            overlay.className = 'hover-overlay';
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'hover-game-title';
            titleSpan.textContent = game.title;
            
            overlay.appendChild(titleSpan);
            tile.appendChild(overlay);
            
            // Hover Video Logic
            let hoverTimeout;
            let videoEl = null;

            tile.addEventListener('mouseenter', () => {
                // Wait 350ms before triggering video to avoid spamming the network on quick mouse-passes
                hoverTimeout = setTimeout(() => {
                    if (!videoEl && game.preview_url) {
                        videoEl = document.createElement('video');
                        videoEl.src = game.preview_url;
                        videoEl.className = 'game-preview-video';
                        videoEl.muted = true;
                        videoEl.loop = true;
                        videoEl.playsInline = true;
                        
                        // Insert video immediately after image
                        const thumb = tile.querySelector('.game-thumbnail');
                        thumb.after(videoEl);
                        
                        // Play the preview and fade it in
                        videoEl.play().then(() => {
                            tile.classList.add('is-previewing');
                        }).catch(e => console.error("Autoplay muted video blocked:", e));
                    } else if (videoEl) {
                        videoEl.play();
                        tile.classList.add('is-previewing');
                    }
                }, 350);
            });

            tile.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimeout);
                tile.classList.remove('is-previewing');
                if (videoEl) {
                    videoEl.pause();
                    videoEl.currentTime = 0; // Reset video to start
                }
            });
            
            // Make clickable to launch
            tile.addEventListener('click', () => openGameModal(game));
            
            gameGrid.appendChild(tile);
        });
    }

    // 3. Game Modal Logic ("Instant Play")
    let currentSessionId = null;

    async function openGameModal(game) {
        if (!game.game_file_path) {
            alert('Game file not available.');
            return;
        }
        
        modalGameTitle.textContent = game.title;
        // Use a cache-buster to ensure the latest index.html and scripts are loaded
        gameFrame.src = game.game_file_path + '?v=' + Date.now();
        gameModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Set initial play count from current game data
        const playCountEl = document.getElementById('modal-play-count');
        if (playCountEl) {
            playCountEl.textContent = new Intl.NumberFormat().format(game.plays || 0);
        }

        // Analytics: Track Play Hit
        try {
            const playResponse = await fetch(`/api/games/${game.id}/play`, { method: 'POST' });
            if (playResponse.ok) {
                const playData = await playResponse.json();
                if (playData.plays && playCountEl) {
                    playCountEl.textContent = new Intl.NumberFormat().format(playData.plays);
                    game.plays = playData.plays; // Sync local data
                }
            }
            
            // Analytics: Start Session
            const response = await fetch('/api/analytics/session/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId: game.id })
            });
            const data = await response.json();
            currentSessionId = data.sessionId;
        } catch (err) {
            console.error('Analytics error:', err);
        }
    }

    async function closeGameModal() {
        gameModal.classList.add('hidden');
        gameFrame.src = ''; // Stop the game
        document.body.style.overflow = ''; // Restore scrolling

        // Analytics: End Session
        if (currentSessionId) {
            try {
                await fetch('/api/analytics/session/end', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: currentSessionId })
                });
                currentSessionId = null;
            } catch (err) {
                console.error('Error ending analytics session:', err);
            }
        }
    }

    closeBtn.addEventListener('click', closeGameModal);

    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                gameModal.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        });
    }

    gameModal.addEventListener('click', (e) => {
        if (e.target === gameModal) {
            closeGameModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !gameModal.classList.contains('hidden')) {
            closeGameModal();
        }
    });

    // 4. Fetch and Render Categories
    async function fetchCategories() {
        try {
            const response = await fetch('/api/categories');
            if (response.ok) {
                const data = await response.json();
                renderCategories(data.categories);
                populateSearchCategories(data.categories);
            }
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    }

    function renderCategories(categories) {
        const catGrid = document.getElementById('category-grid');
        catGrid.innerHTML = '';
        categories.forEach(cat => {
            const tile = document.createElement('a');
            tile.href = '#';
            tile.className = `category-tile category-${cat.size}`;
            
            const img = document.createElement('img');
            img.src = cat.image;
            img.alt = cat.name;
            img.loading = 'lazy';
            
            const span = document.createElement('span');
            span.textContent = cat.name;
            
            tile.appendChild(img);
            tile.appendChild(span);
            catGrid.appendChild(tile);
        });
    }

    // --- Unified Side Panel Logic (Search & Auth) ---
    const searchOpenBtn = document.querySelector('.header-actions .icon-btn[title="Search"]');
    const authOpenBtn = document.getElementById('login-btn');
    const sideCloseBtn = document.getElementById('side-close-btn');
    const sideOverlay = document.getElementById('side-overlay');
    const sidePanel = document.getElementById('side-panel');
    const sideSearchWrapper = document.getElementById('side-search-wrapper');
    const sideSearchContent = document.getElementById('side-search-content');
    const sideAuthContent = document.getElementById('side-auth-content');
    const searchInput = document.getElementById('side-search-input');
    const searchClearBtn = document.getElementById('side-search-clear-btn');
    
    let allGames = []; // Global cache for instant searching

    function toggleSidePanel(show, mode = 'search') {
        if (show) {
            sideOverlay.classList.add('panel-active');
            sidePanel.classList.add('panel-active');
            document.body.style.overflow = 'hidden';
            
            if (mode === 'search') {
                sideSearchWrapper.classList.remove('hidden');
                sideSearchContent.classList.remove('hidden');
                sideAuthContent.classList.add('hidden');
                searchInput.focus();
                populateSearchDefaults();
            } else if (mode === 'auth') {
                sideSearchWrapper.classList.add('hidden');
                sideSearchContent.classList.add('hidden');
                sideAuthContent.classList.remove('hidden');
            }
        } else {
            sideOverlay.classList.remove('panel-active');
            sidePanel.classList.remove('panel-active');
            document.body.style.overflow = '';
            
            // Reset horizontal scroll back to start when closing
            const pillsContainer = document.getElementById('search-category-pills');
            if(pillsContainer) pillsContainer.scrollLeft = 0;
        }
    }

    if(searchOpenBtn) searchOpenBtn.addEventListener('click', () => toggleSidePanel(true, 'search'));
    if(authOpenBtn) authOpenBtn.addEventListener('click', () => toggleSidePanel(true, 'auth'));
    if(sideCloseBtn) sideCloseBtn.addEventListener('click', () => toggleSidePanel(false));
    if(sideOverlay) sideOverlay.addEventListener('click', () => toggleSidePanel(false));

    function setupPillDragging(container) {
        let isDown = false;
        let startX;
        let scrollLeft;

        container.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
            container.style.cursor = 'grabbing';
        });

        container.addEventListener('mouseleave', () => {
            isDown = false;
            container.style.cursor = 'grab';
        });

        container.addEventListener('mouseup', () => {
            isDown = false;
            container.style.cursor = 'grab';
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault(); // Prevent text selection
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 2; // scroll speed multiplier
            container.scrollLeft = scrollLeft - walk;
        });
        
        container.style.cursor = 'grab';
    }

    function populateSearchCategories(categories) {
        const pillsContainer = document.getElementById('search-category-pills');
        pillsContainer.innerHTML = '';
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'category-pill';
            btn.textContent = cat.name;
            
            // Wire up pill click to act as a search query
            btn.addEventListener('click', () => {
                searchInput.value = cat.name;
                searchInput.dispatchEvent(new Event('input'));
            });
            
            pillsContainer.appendChild(btn);
        });
        setupPillDragging(pillsContainer);
    }

    function populateSearchDefaults() {
        if (allGames.length === 0) return;
        
        // 1. Recently Played (2 random games)
        const recentGrid = document.getElementById('recently-played-grid');
        recentGrid.innerHTML = '';
        const recentGames = [...allGames].sort(() => 0.5 - Math.random()).slice(0, 2);
        recentGames.forEach(game => {
            const tile = document.createElement('div');
            tile.className = 'search-item-tile';
            tile.title = game.title;
            
            const img = document.createElement('img');
            img.src = game.thumbnail_url;
            tile.appendChild(img);

            tile.addEventListener('click', () => { 
                toggleSidePanel(false); 
                openGameModal(game); 
            });
            recentGrid.appendChild(tile);
        });

        // 2. Popular this week (12 games)
        const popGrid = document.getElementById('popular-week-grid');
        if(popGrid.children.length === 0) {
            const popGames = [...allGames].sort((a,b) => b.plays - a.plays).slice(0, 12);
            popGames.forEach(game => {
                const tile = document.createElement('div');
                tile.className = 'search-item-tile';
                tile.title = game.title;
                
                const img = document.createElement('img');
                img.src = game.thumbnail_url;
                tile.appendChild(img);

                tile.addEventListener('click', () => { 
                    toggleSidePanel(false); 
                    openGameModal(game); 
                });
                popGrid.appendChild(tile);
            });
        }
    }

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const defaultView = document.getElementById('search-default-view');
        const resultsView = document.getElementById('search-results-view');
        
        if (query.length > 0) {
            searchClearBtn.classList.remove('hidden');
            defaultView.classList.add('hidden');
            resultsView.classList.remove('hidden');
            
            // Filter by title or category
            const matches = allGames.filter(g => {
                const titleMatch = g.title.toLowerCase().includes(query);
                
                // If it's a string from the mock, check it.
                // If the real database starts returning arrays, check those too.
                let catMatch = false;
                if (typeof g.category === 'string') {
                    catMatch = g.category.toLowerCase().includes(query);
                } else if (Array.isArray(g.category)) {
                    catMatch = g.category.some(c => c.toLowerCase().includes(query));
                }
                
                return titleMatch || catMatch;
            });
            
            resultsView.innerHTML = '';
            matches.forEach(game => {
                const tile = document.createElement('div');
                tile.className = 'search-item-tile';
                tile.title = game.title;
                
                const img = document.createElement('img');
                img.src = game.thumbnail_url;
                tile.appendChild(img);

                tile.addEventListener('click', () => { toggleSidePanel(false); openGameModal(game); });
                resultsView.appendChild(tile);
            });
            
            if(matches.length === 0) {
                const noMatches = document.createElement('p');
                noMatches.style.gridColumn = '1/-1';
                noMatches.style.padding = '20px';
                noMatches.style.color = 'var(--text-primary)';
                noMatches.style.fontWeight = '600';
                noMatches.textContent = `No games found matching "${query}"`;
                resultsView.appendChild(noMatches);
            }
        } else {
            searchClearBtn.classList.add('hidden');
            defaultView.classList.remove('hidden');
            resultsView.classList.add('hidden');
        }
    });

    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
    });

    // Initial load modifications to store allGames
    const originalFetchGames = fetchGames;
    fetchGames = async function() {
        try {
            const response = await fetch('/api/games');
            if (response.ok) {
                const data = await response.json();
                allGames = data.games || [];
                renderGames(allGames);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // --- Auth State Logic ---
    const tabRegister = document.getElementById('tab-register');
    const tabLogin = document.getElementById('tab-login');
    const authHeading = document.getElementById('auth-heading');
    const authGuestView = document.getElementById('auth-guest-view');
    const authUserView = document.getElementById('auth-user-view');
    
    // Native Form Elements
    const authNativeForm = document.getElementById('auth-native-form');
    const authRecoveryForm = document.getElementById('auth-recovery-form');
    const registerExtraFields = document.getElementById('register-extra-fields');
    const creatorFields = document.getElementById('creator-fields');
    const authIsCreator = document.getElementById('auth-is-creator');
    
    const inputEmail = document.getElementById('auth-email');
    const inputPassword = document.getElementById('auth-password');
    const inputUsername = document.getElementById('auth-username');
    const inputStudio = document.getElementById('auth-studio');
    const btnAuthSubmit = document.getElementById('btn-auth-submit');
    const passwordToggle = document.getElementById('password-toggle');
    const linkForgotPassword = document.getElementById('link-forgot-password');
    
    // Recovery Flow Elements
    const recoveryStepEmail = document.getElementById('recovery-step-email');
    const recoveryStepCode = document.getElementById('recovery-step-code');
    const inputRecoveryEmail = document.getElementById('recovery-email');
    const inputRecoveryCode = document.getElementById('recovery-code');
    const inputRecoveryNewPassword = document.getElementById('recovery-new-password');
    const btnSendCode = document.getElementById('btn-send-code');
    const btnResetPassword = document.getElementById('btn-reset-password');
    const linkBackToLogin = document.getElementById('link-back-to-login');
    const recoveryPasswordToggle = document.getElementById('recovery-password-toggle');

    const userAvatarContainer = document.getElementById('user-avatar-container');
    const userAvatar = document.getElementById('user-avatar');
    const guestIcon = document.getElementById('guest-icon');
    const profileAvatar = document.getElementById('profile-avatar');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const btnLogout = document.getElementById('btn-logout');

    let currentUser = null;
    let isLoginMode = false; // Default to register tab initial state (which is active in HTML)

    function switchAuthTab(isLogin) {
        isLoginMode = isLogin;
        if (isLogin) {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            authHeading.textContent = 'Welcome back to AUG';
            registerExtraFields.classList.add('hidden');
            document.getElementById('login-extra-links').classList.remove('hidden');
        } else {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            authHeading.textContent = 'Create an AUG Account';
            registerExtraFields.classList.remove('hidden');
            document.getElementById('login-extra-links').classList.add('hidden');
        }
        
        // Ensure forms are reset if switching
        const authOptions = document.querySelector('.auth-options');
        const authTabs = document.querySelector('.auth-tabs');
        if (authOptions) authOptions.classList.remove('hidden');
        if (authTabs) authTabs.classList.remove('hidden');
        
        authNativeForm.classList.remove('hidden');
        authRecoveryForm.classList.add('hidden');
    }

    if (tabLogin) tabLogin.addEventListener('click', () => switchAuthTab(true));
    if (tabRegister) tabRegister.addEventListener('click', () => switchAuthTab(false));

    if (authIsCreator) {
        authIsCreator.addEventListener('change', (e) => {
            if (e.target.checked) creatorFields.classList.remove('hidden');
            else creatorFields.classList.add('hidden');
        });
    }

    // Password Toggle Logic
    function setupPasswordToggle(input, toggle) {
        if (!input || !toggle) return;
        toggle.addEventListener('click', () => {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            // Now following "State" pattern:
            // Shown (text) -> Open Eye
            // Hidden (password) -> Slashed Eye
            toggle.innerHTML = isPassword 
                ? '<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
                : '<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        });
    }

    setupPasswordToggle(inputPassword, passwordToggle);
    setupPasswordToggle(inputRecoveryNewPassword, recoveryPasswordToggle);

    // Inline Validation Helpers
    function setFieldError(fieldId, message) {
        const errorEl = document.getElementById(`error-${fieldId}`);
        const successEl = document.getElementById(`success-${fieldId}`);
        if (!errorEl) return;

        const inputGroup = errorEl.parentElement;
        if (message) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
            inputGroup.classList.add('has-error');
            if (successEl) successEl.classList.add('hidden');
        } else {
            errorEl.textContent = '';
            errorEl.classList.add('hidden');
            inputGroup.classList.remove('has-error');
        }
    }

    function setFieldSuccess(fieldId, message) {
        const errorEl = document.getElementById(`error-${fieldId}`);
        const successEl = document.getElementById(`success-${fieldId}`);
        if (!successEl) return;

        const inputGroup = successEl.parentElement;
        if (message) {
            successEl.textContent = message;
            successEl.classList.remove('hidden');
            inputGroup.classList.remove('has-error');
            if (errorEl) errorEl.classList.add('hidden');
        } else {
            successEl.textContent = '';
            successEl.classList.add('hidden');
        }
    }

    function clearAllErrors() {
        document.querySelectorAll('.field-error, .field-success').forEach(el => {
            el.textContent = '';
            el.classList.add('hidden');
        });
        document.querySelectorAll('.input-group').forEach(el => {
            el.classList.remove('has-error');
        });
    }

    function showRegistrationSuccess() {
        const authOptions = document.querySelector('.auth-options');
        const authTabs = document.querySelector('.auth-tabs');
        if (authOptions) authOptions.classList.add('hidden');
        if (authTabs) authTabs.classList.add('hidden');
        
        authNativeForm.classList.add('hidden');
        authRecoveryForm.classList.add('hidden');
        authSuccessView.classList.remove('hidden');
        authHeading.textContent = ''; // Clear heading to avoid double title
    }

    function showResetSuccess() {
        const authOptions = document.querySelector('.auth-options');
        const authTabs = document.querySelector('.auth-tabs');
        if (authOptions) authOptions.classList.add('hidden');
        if (authTabs) authTabs.classList.add('hidden');

        authNativeForm.classList.add('hidden');
        authRecoveryForm.classList.add('hidden');
        
        authSuccessView.querySelector('h2').textContent = 'Password Reset Successful!';
        authSuccessView.querySelector('p').textContent = 'Your password has been updated. You can now log in with your new credentials.';
        authSuccessView.classList.remove('hidden');
        authHeading.textContent = '';
    }

    // Auth Submission Logic
    if (btnAuthSubmit) {
        btnAuthSubmit.addEventListener('click', async () => {
            const email = inputEmail.value.trim();
            const password = inputPassword.value;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            clearAllErrors();
            if (!email) return setFieldError('auth-email', 'Email is required');
            if (!emailRegex.test(email)) return setFieldError('auth-email', 'Invalid email format');
            if (!password) return setFieldError('auth-password', 'Password is required');

            if (isLoginMode) {
                // Login
                try {
                    const res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    const data = await res.json();
                    if (data.success) {
                        checkAuthState();
                        toggleSidePanel(false);
                    } else {
                        // Map login errors
                        if (data.message.toLowerCase().includes('found')) {
                            setFieldError('auth-email', data.message);
                        } else {
                            setFieldError('auth-password', data.message);
                        }
                    }
                } catch (err) {
                    console.error('Login error:', err);
                }
            } else {
                // Register
                const username = inputUsername.value.trim();
                const isCreator = authIsCreator.checked;
                const studioName = inputStudio.value.trim();

                if (!username) return setFieldError('auth-username', 'Username is required');

                const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
                if (!passwordRegex.test(password)) {
                    return setFieldError('auth-password', 'Password must be 8+ chars, 1 uppercase, 1 number, 1 special char');
                }

                if (isCreator && !studioName) {
                    return setFieldError('auth-studio', 'Studio name is required');
                }

                try {
                    const res = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password, username, isCreator, studioName })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showRegistrationSuccess();
                    } else {
                        // Map registration errors (email taken, etc)
                        if (data.message.toLowerCase().includes('email')) {
                            setFieldError('auth-email', data.message);
                        } else if (data.message.toLowerCase().includes('username')) {
                            setFieldError('auth-username', data.message);
                        } else if (data.message.toLowerCase().includes('studio')) {
                            setFieldError('auth-studio', data.message);
                        } else {
                            setFieldError('auth-email', data.message || 'Registration failed');
                        }
                    }
                } catch (err) {
                    console.error('Registration error:', err);
                }
            }
        });
    }

    // Recovery Flow Logic
    if (linkForgotPassword) {
        linkForgotPassword.addEventListener('click', (e) => {
            e.preventDefault();
            const authOptions = document.querySelector('.auth-options');
            const authTabs = document.querySelector('.auth-tabs');
            if (authOptions) authOptions.classList.add('hidden');
            if (authTabs) authTabs.classList.add('hidden');
            
            authRecoveryForm.classList.remove('hidden');
            recoveryStepEmail.classList.remove('hidden');
            recoveryStepCode.classList.add('hidden');
            authHeading.textContent = 'Reset Password';
        });
    }

    if (linkBackToLogin) {
        linkBackToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            switchAuthTab(true);
        });
    }

    if (btnSendCode) {
        btnSendCode.addEventListener('click', async () => {
            clearAllErrors();
            const email = inputRecoveryEmail.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!email) return setFieldError('recovery-email', 'Email required');
            if (!emailRegex.test(email)) return setFieldError('recovery-email', 'Invalid email format');
            
            try {
                const res = await fetch('/api/auth/forgot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const responseText = await res.text();
                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (parseErr) {
                    console.error('Server returned non-JSON response:', responseText);
                    setFieldError('recovery-email', 'Connection issue. Please refresh and try again.');
                    return;
                }

                if (data.success) {
                    setFieldSuccess('recovery-email', '6-digit code sent to your email.');
                    setTimeout(() => {
                        recoveryStepEmail.classList.add('hidden');
                        recoveryStepCode.classList.remove('hidden');
                    }, 1500);
                } else {
                    // Specific mapping for "Email not found" vs others
                    setFieldError('recovery-email', data.message || 'Error sending code');
                }
            } catch (err) {
                console.error('Recovery request failed:', err);
                setFieldError('recovery-email', 'Connectivity error. Please try again.');
            }
        });
    }

    if (btnResetPassword) {
        btnResetPassword.addEventListener('click', async () => {
            clearAllErrors();
            const email = inputRecoveryEmail.value.trim();
            const code = inputRecoveryCode.value.trim();
            const newPassword = inputRecoveryNewPassword.value;

            if (!code) return setFieldError('recovery-code', 'Code required');
            if (!newPassword) return setFieldError('recovery-password', 'New password required');

            try {
                const res = await fetch('/api/auth/reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code, newPassword })
                });
                const data = await res.json();
                if (data.success) {
                    showResetSuccess();
                } else {
                    if (data.message.toLowerCase().includes('password')) {
                        setFieldError('recovery-password', data.message);
                    } else {
                        setFieldError('recovery-code', data.message);
                    }
                }
            } catch (err) {
                console.error('Reset error:', err);
            }
        });
    }

    async function checkAuthState() {
        try {
            const response = await fetch('/api/me');
            if (response.status === 401) {
                 currentUser = null;
                 return updateAuthUI();
            }
            const data = await response.json();
            if (data.user) {
                currentUser = data.user;
                updateAuthUI();
            } else {
                currentUser = null;
                updateAuthUI();
            }
        } catch (err) {
            console.error('Error checking auth state:', err);
        }
    }

    function getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }

    function updateAuthUI() {
        const defaultAvatar = '/images/media__1773627805120.png';
        const userAvatarInitials = document.getElementById('user-avatar-initials');
        const profileAvatarInitials = document.getElementById('profile-avatar-initials');

        if (currentUser) {
            userAvatarContainer.classList.remove('hidden');
            guestIcon.classList.add('hidden');
            
            const initials = getInitials(currentUser.display_name || currentUser.username || currentUser.email);
            if (userAvatarInitials) userAvatarInitials.textContent = initials;
            if (profileAvatarInitials) profileAvatarInitials.textContent = initials;

            const handleAvatarSuccess = (imgEl, initialsEl) => {
                imgEl.classList.remove('hidden');
                if (initialsEl) initialsEl.classList.add('hidden');
            };

            const handleAvatarError = (imgEl, initialsEl) => {
                imgEl.classList.add('hidden');
                if (initialsEl) initialsEl.classList.remove('hidden');
            };

            if (currentUser.avatar_url) {
                userAvatar.src = currentUser.avatar_url;
                profileAvatar.src = currentUser.avatar_url;

                userAvatar.onload = () => handleAvatarSuccess(userAvatar, userAvatarInitials);
                profileAvatar.onload = () => handleAvatarSuccess(profileAvatar, profileAvatarInitials);

                userAvatar.onerror = () => handleAvatarError(userAvatar, userAvatarInitials);
                profileAvatar.onerror = () => handleAvatarError(profileAvatar, profileAvatarInitials);
            } else {
                handleAvatarError(userAvatar, userAvatarInitials);
                handleAvatarError(profileAvatar, profileAvatarInitials);
            }
            
            profileName.textContent = currentUser.display_name || currentUser.username || 'AUG User';
            profileEmail.textContent = currentUser.email;
            
            authGuestView.classList.add('hidden');
            authUserView.classList.remove('hidden');
        } else {
            userAvatarContainer.classList.add('hidden');
            guestIcon.classList.remove('hidden');
            authGuestView.classList.remove('hidden');
            authUserView.classList.add('hidden');
        }
    }

    // Default tab state on load
    switchAuthTab(false); // Start on register tab per active class in HTML

    // Bind Google OAuth button
    const btnGoogle = document.getElementById('btn-google');
    if (btnGoogle) {
        btnGoogle.addEventListener('click', () => {
            window.location.href = '/auth/google';
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            window.location.href = '/auth/logout';
        });
    }

    const loginToggleBtn = document.getElementById('login-btn');
    if (loginToggleBtn) {
        loginToggleBtn.addEventListener('click', () => {
            toggleSidePanel(true, 'auth');
            checkAuthState();
        });
    }

    // Registration Success Handlers
    const btnSuccessOk = document.getElementById('btn-success-ok');
    const authSuccessView = document.getElementById('auth-success-view');

    if (btnSuccessOk) {
        btnSuccessOk.addEventListener('click', () => {
            if (authSuccessView) authSuccessView.classList.add('hidden');
            switchAuthTab(true); // Switch to Login tab
        });
    }

    // Initialize application data
    fetchGames();
    fetchCategories();
    checkAuthState();

});
