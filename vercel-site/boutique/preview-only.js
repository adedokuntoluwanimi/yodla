// Disable external order/message actions in review deployments, while preserving
// the browser-local recipient form used to build gifts.
const form = document.querySelector('[data-checkout-form]');
function previewCheckout() {
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  if (button) {
    button.disabled = true;
    if (button.textContent !== 'Preview only, payments disabled') button.textContent = 'Preview only, payments disabled';
  }
  if (!document.querySelector('[data-preview-checkout-notice]')) {
    const notice = document.createElement('p');
    notice.dataset.previewCheckoutNotice = '';
    notice.style.cssText = 'padding:16px;border:1px solid #bba077;color:#511b28;font-size:13px;line-height:1.6';
    notice.textContent = 'This is the Yodla boutique concept preview. No payment is taken and no order or email is sent.';
    form.prepend(notice);
  }
}
window.addEventListener('submit', event => {
  if (event.target?.id === 'recipient-form') return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
previewCheckout();
if (form) new MutationObserver(previewCheckout).observe(form, { childList:true, subtree:true });
