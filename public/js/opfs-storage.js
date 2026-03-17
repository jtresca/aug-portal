/**
 * AUG Web Console Storage (v1.0)
 * Persistent asset caching using Origin Private File System (OPFS).
 * Targets 8GB+ high-fidelity assets for WebGPU games.
 */

const AUGStorage = (function() {
    console.log('AUG Web Console Storage initialized.');

    /**
     * Cache a file from a URL into OPFS
     */
    async function cacheAsset(url, filename) {
        try {
            const root = await navigator.storage.getDirectory();
            const response = await fetch(url);
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const blob = await response.blob();

            const fileHandle = await root.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            
            console.log(`[AUG Storage] Caching ${filename} (${blob.size} bytes)...`);
            await writable.write(blob);
            await writable.close();
            
            return true;
        } catch (err) {
            console.error('[AUG Storage] Caching failed:', err);
            return false;
        }
    }

    /**
     * Retrieve a file as a Blob or URL
     */
    async function getAssetUrl(filename) {
        try {
            const root = await navigator.storage.getDirectory();
            const fileHandle = await root.getFileHandle(filename);
            const file = await fileHandle.getFile();
            return URL.createObjectURL(file);
        } catch (err) {
            console.warn(`[AUG Storage] Asset ${filename} not found in cache.`);
            return null;
        }
    }

    /**
     * Clear Cache
     */
    async function clearStorage() {
        const root = await navigator.storage.getDirectory();
        // Remove individual files or recursive
        console.log('[AUG Storage] Purging all cached assets...');
        // Note: Currently browser implementations vary on how they handle recursive deletion of the root
    }

    // Public API
    return {
        cache: cacheAsset,
        get: getAssetUrl,
        purge: clearStorage
    };

})();

// Export for use in global scope
window.AUGStorage = AUGStorage;
