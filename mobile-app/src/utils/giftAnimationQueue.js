/**
 * Gift Animation Queue Controller
 * Manages incoming gift animation events sequentially (FIFO)
 * to prevent overlapping animation lag or low-end device crashes.
 */

class GiftAnimationQueue {
    constructor() {
        this.queue = [];
        this.isPlaying = false;
        this.currentGift = null;
        this.onPlayGift = null;
        this.onQueueEmpty = null;
    }

    /**
     * Set callback when a gift should be displayed.
     * @param {Function} callback (giftData, onFinished) => void
     */
    setPlayHandler(callback) {
        this.onPlayGift = callback;
    }

    /**
     * Set callback when the queue becomes empty.
     * @param {Function} callback () => void
     */
    setEmptyHandler(callback) {
        this.onQueueEmpty = callback;
    }

    /**
     * Enqueue a new gift animation.
     * @param {Object} giftData Details about the gift (id, name, animationUrl, sender)
     */
    enqueue(giftData) {
        if (!giftData) return;
        this.queue.push(giftData);
        this.processNext();
    }

    /**
     * Process next gift in the queue if not currently playing.
     */
    processNext() {
        if (this.isPlaying || this.queue.length === 0) {
            if (this.queue.length === 0 && !this.isPlaying && this.onQueueEmpty) {
                this.onQueueEmpty();
            }
            return;
        }

        this.isPlaying = true;
        this.currentGift = this.queue.shift();

        if (this.onPlayGift) {
            this.onPlayGift(this.currentGift, () => this.finishCurrent());
        } else {
            // Fallback timeout if no handler defined
            setTimeout(() => this.finishCurrent(), 2500);
        }
    }

    /**
     * Marks the current gift animation as completed.
     */
    finishCurrent() {
        this.isPlaying = false;
        this.currentGift = null;
        this.processNext();
    }

    /**
     * Clear all pending animations.
     */
    clear() {
        this.queue = [];
        this.isPlaying = false;
        this.currentGift = null;
        if (this.onQueueEmpty) this.onQueueEmpty();
    }
}

export const giftAnimationQueue = new GiftAnimationQueue();
