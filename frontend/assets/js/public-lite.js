(function () {
  const ready = (callback) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  };

  const closeSiblingAccordions = (trigger, target) => {
    const parentSelector = target.getAttribute('data-bs-parent');
    if (!parentSelector) return;
    const parent = document.querySelector(parentSelector);
    if (!parent) return;

    parent.querySelectorAll('.accordion-collapse.show').forEach((panel) => {
      if (panel === target) return;
      panel.classList.remove('show');
      const button = parent.querySelector(`[data-bs-target="#${panel.id}"]`);
      if (button) {
        button.classList.add('collapsed');
        button.setAttribute('aria-expanded', 'false');
      }
    });
  };

  ready(() => {
    document.querySelectorAll('[data-bs-toggle="collapse"]').forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const selector = trigger.getAttribute('data-bs-target') || trigger.getAttribute('href');
        if (!selector || selector === '#') return;
        const target = document.querySelector(selector);
        if (!target) return;

        const willOpen = !target.classList.contains('show');
        if (trigger.classList.contains('accordion-button')) {
          closeSiblingAccordions(trigger, target);
        }

        target.classList.toggle('show', willOpen);
        trigger.classList.toggle('collapsed', !willOpen);
        trigger.setAttribute('aria-expanded', String(willOpen));
      });
    });
  });
})();
