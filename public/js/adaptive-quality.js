class AdaptiveQualityManager {
  constructor() {
    this.currentQuality = 'auto';
    this.appliedQuality = 'medium';

    this.qualitySettings = {
      low: { animations: false, imageQuality: 50, throttleFPS: 30 },
      medium: { animations: true, imageQuality: 75, throttleFPS: 45 },
      high: { animations: true, imageQuality: 100, throttleFPS: 60 }
    };
  }

  async initialize() {
    this.loadQualityPreference();
    this.applyQuality();
    console.log(`Quality initialized: ${this.appliedQuality}`);
  }

  loadQualityPreference() {
    const saved = localStorage.getItem('adaptiveQuality');
    if (saved && ['auto', 'low', 'medium', 'high'].includes(saved)) {
      this.currentQuality = saved;
    }
  }

  setQuality(quality) {
    this.currentQuality = quality;
    localStorage.setItem('adaptiveQuality', quality);
    this.applyQuality();
  }

  applyQuality() {
    const quality = this.currentQuality === 'auto' ? this.detectTier() : this.currentQuality;
    this.appliedQuality = quality;

    document.body.classList.remove('quality-low', 'quality-medium', 'quality-high');
    document.body.classList.add(`quality-${quality}`);

    // Dispatch event cho performance optimizer và UI
    window.dispatchEvent(new CustomEvent('qualityChanged', { detail: { quality: this.currentQuality } }));
  }

  detectTier() {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;

    if (cores <= 2 || memory <= 2) return 'low';
    if (cores <= 4 || memory <= 4) return 'medium';
    return 'high';
  }

  getCurrentSettings() {
    return this.qualitySettings[this.appliedQuality];
  }
}

window.AdaptiveQualityManager = AdaptiveQualityManager;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initQuality);
} else {
  initQuality();
}

function initQuality() {
  // CRITICAL: Prevent multiple initialization
  if (window.qualityManager) {
    console.warn('[AdaptiveQuality] Already initialized, skipping');
    return;
  }

  window.qualityManager = new AdaptiveQualityManager();
  window.qualityManager.initialize();

  // Initialize UI if available
  if (window.QualitySettingsUI && !window.qualitySettingsUI) {
    window.qualitySettingsUI = new QualitySettingsUI();
    window.qualitySettingsUI.initialize(window.qualityManager);
  }
}
