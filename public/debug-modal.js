/**
 * Quality Settings Modal - Debug & Test Script
 * Paste into browser console to debug modal issues
 */

console.log('=== Quality Settings Modal Debug ===');

// 1. Check if modal exists
const modal = document.getElementById('quality-settings-modal');
console.log('1. Modal element:', modal ? '✅ Found' : '❌ Not found');

if (modal) {
  console.log('   - Classes:', modal.className);
  console.log('   - Display:', getComputedStyle(modal).display);
  console.log('   - Visibility:', getComputedStyle(modal).visibility);
}

// 2. Check button
const btn = document.getElementById('quality-settings-btn');
console.log('2. Settings button:', btn ? '✅ Found' : '❌ Not found');

// 3. Check QualitySettingsUI instance
console.log('3. QualitySettingsUI:', window.qualitySettingsUI ? '✅ Initialized' : '❌ Not initialized');
if (window.qualitySettingsUI) {
  console.log('   - isOpen:', window.qualitySettingsUI.isOpen);
  console.log('   - initialized:', window.qualitySettingsUI.initialized);
}

// 4. Check for duplicate modals
const allModals = document.querySelectorAll('#quality-settings-modal');
console.log('4. Modal count:', allModals.length, allModals.length > 1 ? '❌ DUPLICATES!' : '✅ OK');

// 5. Force close if modal is stuck open
if (modal && modal.classList.contains('active')) {
  console.log('5. Modal is OPEN - attempting to close...');
  modal.classList.remove('active');
  if (window.qualitySettingsUI) {
    window.qualitySettingsUI.isOpen = false;
  }
  console.log('   ✅ Modal closed');
} else {
  console.log('5. Modal is closed ✅');
}

// 6. Test open/close functions
console.log('6. Testing functions:');
if (window.qualitySettingsUI) {
  console.log('   - openModal:', typeof window.qualitySettingsUI.openModal);
  console.log('   - closeModal:', typeof window.qualitySettingsUI.closeModal);

  // Test open
  console.log('   Testing open...');
  window.qualitySettingsUI.openModal();
  setTimeout(() => {
    console.log('   - isOpen after open:', window.qualitySettingsUI.isOpen);
    console.log('   - modal classes:', modal.className);

    // Test close
    console.log('   Testing close...');
    window.qualitySettingsUI.closeModal();
    setTimeout(() => {
      console.log('   - isOpen after close:', window.qualitySettingsUI.isOpen);
      console.log('   - modal classes:', modal.className);
      console.log('   ✅ Test complete');
    }, 100);
  }, 100);
}

console.log('=== Debug Complete ===');

// Export helper functions
window.debugModal = {
  open: () => window.qualitySettingsUI?.openModal(),
  close: () => window.qualitySettingsUI?.closeModal(),
  forceClose: () => {
    const m = document.getElementById('quality-settings-modal');
    if (m) {
      m.classList.remove('active');
      if (window.qualitySettingsUI) window.qualitySettingsUI.isOpen = false;
      console.log('✅ Force closed');
    }
  },
  remove: () => {
    const m = document.getElementById('quality-settings-modal');
    if (m) {
      m.remove();
      console.log('✅ Modal removed');
    }
  },
  info: () => {
    const m = document.getElementById('quality-settings-modal');
    console.log('Modal:', m);
    console.log('Classes:', m?.className);
    console.log('isOpen:', window.qualitySettingsUI?.isOpen);
    console.log('initialized:', window.qualitySettingsUI?.initialized);
  }
};

console.log('💡 Helper functions available:');
console.log('   debugModal.open() - Open modal');
console.log('   debugModal.close() - Close modal');
console.log('   debugModal.forceClose() - Force close');
console.log('   debugModal.remove() - Remove modal');
console.log('   debugModal.info() - Show info');
