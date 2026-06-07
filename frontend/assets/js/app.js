(function () {
  const unique = (values) => [...new Set(values.filter(Boolean))];
  const normalizeApiBase = (value) => String(value || '').replace(/\/+$/, '');
  const getApiBaseCandidates = () => {
    const origin =
      window.location.origin && window.location.origin !== 'null'
        ? normalizeApiBase(`${window.location.origin}/api`)
        : '';
    const host = window.location.hostname;
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(host);
    const isHttpsPage = window.location.protocol === 'https:';
    const localApi = `${isHttpsPage ? 'https' : 'http'}://localhost:${isHttpsPage ? '5443' : '5000'}/api`;
    const configured = normalizeApiBase(localStorage.getItem('paperForgeApi'));
    const safeConfigured = (() => {
      if (!configured) return '';
      try {
        const url = new URL(configured);
        const isConfiguredLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
        if (isHttpsPage && url.protocol === 'http:') {
          if (isConfiguredLocal) {
            localStorage.setItem('paperForgeApi', localApi);
            return localApi;
          }
          localStorage.removeItem('paperForgeApi');
          return '';
        }
        return configured;
      } catch (error) {
        localStorage.removeItem('paperForgeApi');
        return '';
      }
    })();
    const candidates = [];

    if (origin && isHttpsPage) {
      candidates.push(origin, localApi);
    } else if (origin && window.location.port && window.location.port !== '5000') {
      candidates.push(localApi, origin);
    } else if (origin) {
      candidates.push(origin);
    }

    if (!origin || isLocalHost) candidates.push(localApi);
    candidates.push(safeConfigured);
    return unique(candidates.map(normalizeApiBase));
  };
  const API_BASES = getApiBaseCandidates();
  let activeApiBase = API_BASES[0];
  const detectAppRootPath = () => {
    const pathname = window.location.pathname || '';
    const scriptPath = document.currentScript?.getAttribute('src') || '';
    if (pathname === '/frontend' || pathname.startsWith('/frontend/') || scriptPath.startsWith('/frontend/')) {
      return '/frontend';
    }
    return '';
  };
  const APP_ROOT_PATH = detectAppRootPath();
  const appUrl = (path = '') => {
    const value = String(path || '');
    if (/^(?:https?:|mailto:|tel:|#)/i.test(value)) return value;
    const normalized = value.startsWith('/') ? value : `/${value}`;
    if (!APP_ROOT_PATH || normalized === APP_ROOT_PATH || normalized.startsWith(`${APP_ROOT_PATH}/`)) {
      return normalized;
    }
    return `${APP_ROOT_PATH}${normalized}`;
  };

  const roleHomes = {
    teacher: appUrl('/dashboard/teacher-dashboard.html'),
    student: appUrl('/dashboard/student-dashboard.html'),
    admin: appUrl('/dashboard/admin-dashboard.html'),
    super_admin: appUrl('/dashboard/admin-dashboard.html')
  };
  const isSuperAdminUser = (user) => user?.role === 'super_admin' || user?.isSuperAdmin === true;
  const isAdminUser = (user) => ['admin', 'super_admin'].includes(user?.role);
  const isRoleAllowed = (userRole, allowedRoles = []) =>
    allowedRoles.includes(userRole) || (userRole === 'super_admin' && allowedRoles.includes('admin'));

  const syllabus = {
    '9th': {
      Physics: [
        'Physical Quantities and Measurement',
        'Kinematics',
        'Dynamics',
        'Turning Effect of Forces',
        'Gravitation',
        'Work and Energy',
        'Properties of Matter',
        'Thermal Properties'
      ],
      Chemistry: [
        'Fundamentals of Chemistry',
        'Structure of Atoms',
        'Periodic Table',
        'Structure of Molecules',
        'Physical States of Matter',
        'Solutions',
        'Electrochemistry',
        'Chemical Reactivity'
      ],
      Math: [
        'Matrices and Determinants',
        'Real and Complex Numbers',
        'Logarithms',
        'Algebraic Expressions',
        'Factorization',
        'Linear Equations',
        'Coordinate Geometry',
        'Congruent Triangles'
      ]
    },
    '10th': {
      Physics: [
        'Simple Harmonic Motion and Waves',
        'Sound',
        'Geometrical Optics',
        'Electrostatics',
        'Current Electricity',
        'Electromagnetism',
        'Basic Electronics',
        'Information Technology'
      ],
      Chemistry: [
        'Chemical Equilibrium',
        'Acids Bases and Salts',
        'Organic Chemistry',
        'Hydrocarbons',
        'Biochemistry',
        'Atmosphere',
        'Water',
        'Chemical Industries'
      ],
      Math: [
        'Quadratic Equations',
        'Theory of Quadratic Equations',
        'Variations',
        'Partial Fractions',
        'Sets and Functions',
        'Basic Statistics',
        'Introduction to Trigonometry',
        'Projection of a Side of a Triangle'
      ]
    },
    '1st Year': {
      Physics: [
        'Measurements',
        'Vectors and Equilibrium',
        'Motion and Force',
        'Work and Energy',
        'Circular Motion',
        'Fluid Dynamics',
        'Oscillations',
        'Waves'
      ],
      Chemistry: [
        'Basic Concepts',
        'Experimental Techniques',
        'Gases',
        'Liquids and Solids',
        'Atomic Structure',
        'Chemical Bonding',
        'Thermochemistry',
        'Chemical Equilibrium'
      ],
      Math: [
        'Number Systems',
        'Sets Functions and Groups',
        'Matrices and Determinants',
        'Quadratic Equations',
        'Sequences and Series',
        'Permutations Combinations and Probability',
        'Mathematical Induction',
        'Trigonometric Functions'
      ]
    },
    '2nd Year': {
      Physics: [
        'Electrostatics',
        'Current Electricity',
        'Electromagnetism',
        'Electromagnetic Induction',
        'Alternating Current',
        'Physics of Solids',
        'Electronics',
        'Modern Physics'
      ],
      Chemistry: [
        'Periodic Classification',
        's Block Elements',
        'Group IIIA and IVA Elements',
        'Group VA and VIA Elements',
        'Transition Elements',
        'Organic Chemistry',
        'Hydrocarbons',
        'Macromolecules'
      ],
      Math: [
        'Functions and Limits',
        'Differentiation',
        'Integration',
        'Introduction to Analytic Geometry',
        'Linear Programming',
        'Conic Sections',
        'Vectors',
        'Probability'
      ]
    }
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const cleanQuestionText = (value) => {
    let text = String(value ?? '').trim();
    const prefixes = [
      /^\s*\d+\s*[:.)-]\s*/i,
      /^\s*(?:mcqs?|short(?:\s+questions?)?|long(?:\s+questions?)?|questions?)\s*(?:no\.?|number|#)?\s*\d+\s*[:.)-]\s*/i
    ];

    let changed = true;
    while (changed) {
      changed = false;
      prefixes.forEach((pattern) => {
        const next = text.replace(pattern, '').trim();
        if (next !== text) {
          text = next;
          changed = true;
        }
      });
    }

    return text;
  };

  const formatMarks = (value) => {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '0';
    return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '');
  };

  const sectionStats = (paper, type, questions) => {
    const count = questions.length;
    const configuredMarks = Number(paper?.marksPerQuestion?.[type] || questions[0]?.marks || 0);
    const total = questions.reduce((sum, question) => sum + Number(question.marks || 0), 0);
    const allSame = questions.every((question) => Number(question.marks || 0) === configuredMarks);
    return {
      count,
      marksEach: configuredMarks,
      total,
      formula: count && configuredMarks && allSame
        ? `${count}*${formatMarks(configuredMarks)}=${formatMarks(total)}`
        : `Total = ${formatMarks(total)}`
    };
  };

  const sectionHeading = (title, stats) =>
    `<span>${title}</span><span class="section-formula">${escapeHtml(stats.formula)} marks</span>`;

  const importantStar = (question) =>
    question?.isImportant ? '<strong class="important-star">*</strong> ' : '';

  const getSession = () => ({
    token: localStorage.getItem('paperForgeToken'),
    user: JSON.parse(localStorage.getItem('paperForgeUser') || 'null')
  });

  const saveSession = ({ token, user }) => {
    localStorage.setItem('paperForgeToken', token);
    localStorage.setItem('paperForgeUser', JSON.stringify(user));
  };

  const clearSession = () => {
    localStorage.removeItem('paperForgeToken');
    localStorage.removeItem('paperForgeUser');
  };

  const redirectByRole = (role) => {
    window.location.href = roleHomes[role] || '/login.html';
  };

  const showMessage = (message, type = 'info') => {
    const toast = $('#appToast');
    if (!toast) {
      if (type === 'danger') alert(message);
      return;
    }

    toast.className = `app-toast app-toast-${type}`;
    toast.textContent = message;
    toast.hidden = false;
    window.setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  };

  const api = async (path, options = {}) => {
    const { token } = getSession();
    const headers = {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const body =
      options.body instanceof FormData
        ? options.body
        : options.body
          ? JSON.stringify(options.body)
          : undefined;
    const bases = unique([activeApiBase, ...API_BASES]);
    let connectionError = null;

    for (const base of bases) {
      let response;
      try {
        response = await fetch(`${base}${path}`, {
          method: options.method || 'GET',
          headers,
          body
        });
      } catch (error) {
        connectionError = error;
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        if (response.status === 404 && bases.indexOf(base) < bases.length - 1) {
          connectionError = new Error('API route not found on this host');
          continue;
        }
        const serverMessage = typeof data === 'string' ? data.trim() : data.message;
        throw new Error(serverMessage || `Request failed (${response.status})`);
      }

      if (!isJson) {
        connectionError = new Error('API did not return JSON');
        continue;
      }

      activeApiBase = base;
      localStorage.setItem('paperForgeApi', base);
      return data;
    }

    throw new Error(
      connectionError?.message === 'Failed to fetch'
        ? 'Backend API se connection nahi ho raha. Backend server run karein ya API URL check karein.'
        : connectionError?.message || 'Backend API se connection nahi ho raha.'
    );
  };

  const downloadFile = async (path, filename) => {
    const { token } = getSession();
    const bases = unique([activeApiBase, ...API_BASES]);
    let response;
    let data = {};

    for (const base of bases) {
      try {
        response = await fetch(`${base}${path}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
      } catch (error) {
        continue;
      }

      if (response.ok) {
        activeApiBase = base;
        localStorage.setItem('paperForgeApi', base);
        break;
      }

      data = await response.json().catch(() => ({}));
      if (response.status !== 404) break;
    }

    if (!response || !response.ok) {
      throw new Error(data.message || 'Download failed');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const profileLabel = (value, fallback = '-') => {
    const labels = {
      admin: 'Administrator',
      super_admin: 'Super Administrator',
      teacher: 'Teacher',
      student: 'Student',
      free_trial_used: 'Free Trial Used',
      trial_available: 'Trial Available'
    };
    const key = String(value || '').toLowerCase();
    return labels[key] || String(value || fallback).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const profileInitials = (user) => {
    const source = user?.name || user?.email || 'User';
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  };

  const profileDate = (value) => (value ? new Date(value).toLocaleDateString() : 'No expiry');

  const profileSubscriptionText = (user) => {
    if (isAdminUser(user)) return 'Platform access';
    const status = profileLabel(user?.subscriptionStatus || (user?.subscription === 'pro' ? 'active' : 'pending'), 'Free');
    const plan = profileLabel(user?.subscriptionPlan || user?.subscription || 'free', 'Free');
    const days = Number(user?.subscriptionRemainingDays);
    const remaining = Number.isFinite(days) && days > 0 ? ` / ${days} days left` : '';
    return `${status} / ${plan}${remaining}`;
  };

  const renderProfileMenu = (user) => {
    const role = profileLabel(user?.role, 'User');
    const home = roleHomes[user?.role] || '/login.html';
    const secondaryAction =
      isAdminUser(user)
        ? isSuperAdminUser(user)
          ? `<a href="${appUrl('/admin/settings.html')}"><i class="bi bi-gear"></i><span>Settings</span></a>`
          : `<a href="${appUrl('/dashboard/admin-dashboard.html')}"><i class="bi bi-speedometer2"></i><span>Dashboard</span></a>`
        : `<a href="${appUrl('/subscription.html')}"><i class="bi bi-credit-card"></i><span>Subscription</span></a>`;

    return `
      <div class="profile-menu-head">
        <span class="profile-menu-avatar">${escapeHtml(profileInitials(user))}</span>
        <div>
          <strong>${escapeHtml(user?.name || 'User')}</strong>
          <small>${escapeHtml(user?.email || 'No email saved')}</small>
        </div>
      </div>
      <div class="profile-detail-list">
        <div class="profile-detail-row"><span>Role</span><strong>${escapeHtml(role)}</strong></div>
        <div class="profile-detail-row"><span>Account</span><strong>${escapeHtml(profileLabel(user?.status, 'Active'))}</strong></div>
        <div class="profile-detail-row"><span>Plan</span><strong>${escapeHtml(profileSubscriptionText(user))}</strong></div>
        <div class="profile-detail-row"><span>Expiry</span><strong>${escapeHtml(profileDate(user?.subscriptionEndDate))}</strong></div>
      </div>
      <div class="profile-menu-actions">
        <a href="${home}"><i class="bi bi-speedometer2"></i><span>Dashboard</span></a>
        ${secondaryAction}
        <button type="button" class="profile-menu-logout"><i class="bi bi-box-arrow-left"></i><span>Logout</span></button>
      </div>
    `;
  };

  const closeProfileMenus = (except = null) => {
    $$('.profile-menu-wrap.is-open').forEach((wrapper) => {
      if (wrapper === except) return;
      wrapper.classList.remove('is-open');
      const chip = $('.profile-chip', wrapper);
      const menu = $('.profile-menu', wrapper);
      chip?.classList.remove('is-open');
      chip?.setAttribute('aria-expanded', 'false');
      if (menu) menu.hidden = true;
    });
  };

  const refreshProfileMenu = async (menu) => {
    try {
      const { token } = getSession();
      const data = await api('/auth/me');
      if (!data?.user) return;
      saveSession({ token, user: data.user });
      menu.innerHTML = renderProfileMenu(data.user);
    } catch (error) {
      const { user } = getSession();
      menu.innerHTML = renderProfileMenu(user);
    }
  };

  const wireProfileMenu = (currentUser = null) => {
    const { user: sessionUser } = getSession();
    const user = currentUser || sessionUser;
    if (!user) return;

    $$('.profile-chip').forEach((chip) => {
      if (chip.dataset.profileWired === 'true') {
        const menu = $('.profile-menu', chip.closest('.profile-menu-wrap'));
        if (menu) menu.innerHTML = renderProfileMenu(user);
        return;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'profile-menu-wrap';
      chip.parentNode.insertBefore(wrapper, chip);
      wrapper.appendChild(chip);

      const menu = document.createElement('div');
      menu.className = 'profile-menu';
      menu.hidden = true;
      menu.innerHTML = renderProfileMenu(user);
      wrapper.appendChild(menu);

      chip.dataset.profileWired = 'true';
      chip.setAttribute('role', 'button');
      chip.setAttribute('tabindex', '0');
      chip.setAttribute('aria-haspopup', 'menu');
      chip.setAttribute('aria-expanded', 'false');
      chip.setAttribute('title', 'Open profile');

      const toggleMenu = async () => {
        const shouldOpen = !wrapper.classList.contains('is-open');
        closeProfileMenus(wrapper);
        wrapper.classList.toggle('is-open', shouldOpen);
        chip.classList.toggle('is-open', shouldOpen);
        chip.setAttribute('aria-expanded', String(shouldOpen));
        menu.hidden = !shouldOpen;
        if (shouldOpen) await refreshProfileMenu(menu);
      };

      chip.addEventListener('click', (event) => {
        event.preventDefault();
        toggleMenu();
      });

      chip.addEventListener('keydown', (event) => {
        if (!['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        toggleMenu();
      });

      wrapper.addEventListener('click', (event) => {
        const logoutButton = event.target.closest('.profile-menu-logout');
        if (!logoutButton) return;
        clearSession();
        window.location.href = appUrl('/login.html');
      });
    });

    if (document.body.dataset.profileMenuGlobal === 'true') return;
    document.body.dataset.profileMenuGlobal = 'true';
    document.addEventListener('click', (event) => {
      if (event.target.closest('.profile-menu-wrap')) return;
      closeProfileMenus();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeProfileMenus();
    });
  };

  const requireAuth = (roles = []) => {
    const { token, user } = getSession();
    if (!token || !user) {
      window.location.href = appUrl('/login.html');
      return null;
    }

    if (roles.length && !isRoleAllowed(user.role, roles)) {
      redirectByRole(user.role);
      return null;
    }
    $$('.js-user-name').forEach((node) => {
      node.textContent = user.name;
    });
    $$('.js-user-role').forEach((node) => {
      node.textContent = user.role;
    });

    wireProfileMenu(user);

    return user;
  };

  const requireSuperAdminPage = () => {
    const user = requireAuth(['admin']);
    if (!user) return null;
    if (!isSuperAdminUser(user)) {
      showMessage('Only the super admin can open this page', 'danger');
      window.location.href = appUrl('/dashboard/admin-dashboard.html');
      return null;
    }
    return user;
  };

  const adaptPaperShellForRole = (user) => {
    if (user.role !== 'student') return;

    const brandLabel = $('.brand-role') || $('.brand span:last-child');
    if (brandLabel) brandLabel.textContent = 'Student';

    const dashboardLink = $('.sidebar a[href$="/dashboard/teacher-dashboard.html"]');
    if (dashboardLink) {
      dashboardLink.href = appUrl('/dashboard/student-dashboard.html');
      dashboardLink.innerHTML = '<i class="bi bi-speedometer2"></i> Dashboard';
    }

    const sidebar = $('.sidebar');
    const logoutButton = $('.js-logout');
    const addLink = (href, label) => {
      const resolvedHref = appUrl(href);
      if (!sidebar || $(`.sidebar a[href="${resolvedHref}"], .sidebar a[href="${href}"]`)) return;
      const link = document.createElement('a');
      link.href = resolvedHref;
      link.innerHTML = label;
      sidebar.insertBefore(link, logoutButton || null);
    };

    addLink('/resources.html', '<i class="bi bi-folder2-open"></i> Past Papers & Books');
    addLink('/subscription.html', '<i class="bi bi-credit-card"></i> Subscription');
  };

  const wireLogout = () => {
    $$('.js-logout').forEach((button) => {
      button.addEventListener('click', () => {
        clearSession();
        window.location.href = appUrl('/login.html');
      });
    });
  };

  const applyBrandHomeAttributes = () => {
    $$('.brand').forEach((brand) => {
      brand.setAttribute('role', 'link');
      brand.setAttribute('tabindex', '0');
      brand.setAttribute('title', 'Open dashboard');
    });
  };

  const goToRoleDashboard = () => {
    const { user } = getSession();
    const href = roleHomes[user?.role];
    if (href) window.location.href = href;
  };

  const wireBrandHome = () => {
    applyBrandHomeAttributes();
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.brand')) return;
      goToRoleDashboard();
    });
    document.addEventListener('keydown', (event) => {
      if (!event.target.closest('.brand')) return;
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      goToRoleDashboard();
    });
  };

  const normalizeInternalLinks = (scope = document) => {
    if (!APP_ROOT_PATH) return;
    $$('a[href^="/"]', scope).forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('//') || href.startsWith('/api/') || href.startsWith('/uploads/')) return;
      link.setAttribute('href', appUrl(href));
    });
    $$('img[src^="/assets/"]', scope).forEach((image) => {
      image.setAttribute('src', appUrl(image.getAttribute('src')));
    });
  };

  const wireDashboardSearch = () => {
    $$('.dashboard-search input').forEach((input) => {
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        const query = input.value.trim().toLowerCase();
        if (!query) return;
        const match = $$('.sidebar a').find((link) => link.textContent.toLowerCase().includes(query));
        if (match) window.location.href = match.href;
      });
    });
  };

  const passwordToggleIcon = (visible) =>
    visible
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.5 5.4A9.8 9.8 0 0 1 12 5c5 0 8.5 4.2 9.6 6.8a11.5 11.5 0 0 1-2.1 3.1"/><path d="M6.4 6.4A12.8 12.8 0 0 0 2.4 11.8C3.5 14.4 7 18.5 12 18.5a9.9 9.9 0 0 0 4-.8"/></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.4 12C3.5 9.4 7 5.3 12 5.3s8.5 4.1 9.6 6.7c-1.1 2.6-4.6 6.7-9.6 6.7S3.5 14.6 2.4 12z"/><circle cx="12" cy="12" r="2.7"/></svg>`;

  const wirePasswordToggles = () => {
    $$('input[type="password"], input[data-password-toggle="true"]').forEach((input) => {
      if (input.dataset.passwordToggle === 'true') return;

      const wrapper = document.createElement('span');
      wrapper.className = 'password-field-wrap';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'password-toggle';
      button.setAttribute('aria-label', 'Show password');
      button.setAttribute('title', 'Show password');
      button.innerHTML = passwordToggleIcon(false);
      wrapper.appendChild(button);

      input.dataset.passwordToggle = 'true';
      button.addEventListener('click', () => {
        const willShow = input.type === 'password';
        input.type = willShow ? 'text' : 'password';
        button.setAttribute('aria-label', willShow ? 'Hide password' : 'Show password');
        button.setAttribute('title', willShow ? 'Hide password' : 'Show password');
        button.classList.toggle('is-visible', willShow);
        button.innerHTML = passwordToggleIcon(willShow);
      });
    });
  };

  const formValue = (form, name) => form.elements[name]?.value?.trim() || '';
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  const isValidEmail = (value) => emailPattern.test(String(value || '').trim());
  const validateEmailInput = (input) => {
    if (!input) return true;
    const value = input.value.trim();
    const valid = !value || isValidEmail(value);
    input.setCustomValidity(valid ? '' : 'Please enter a valid email address, for example name@example.com.');
    return valid;
  };
  const getEmailValue = (form, { fallback = '' } = {}) => {
    const input = form?.elements?.email || null;
    const value = (fallback || input?.value || '').trim().toLowerCase();
    if (input) input.value = value;
    if (!value || !isValidEmail(value)) {
      if (input) {
        input.setCustomValidity('Please enter a valid email address, for example name@example.com.');
        input.reportValidity();
        input.focus();
      }
      throw new Error('Please enter a valid email address.');
    }
    if (input) input.setCustomValidity('');
    return value;
  };
  const wireEmailValidation = () => {
    $$('input[name="email"], input[inputmode="email"]').forEach((input) => {
      input.type = 'email';
      input.inputMode = 'email';
      input.autocomplete = 'email';
      validateEmailInput(input);
      input.addEventListener('input', () => validateEmailInput(input));
      input.addEventListener('blur', () => validateEmailInput(input));
    });
  };
  const checkedValues = (form, name) =>
    $$(`input[name="${name}"]:checked`, form).map((input) => input.value);
  const multiSelectValues = (form, name) =>
    Array.from(form.elements[name]?.selectedOptions || []).map((option) => option.value);
  const chapterValues = (form) => {
    const checked = checkedValues(form, 'chapters');
    return checked.length ? checked : multiSelectValues(form, 'chapters');
  };

  const wireChapterSelect = (formSelector) => {
    const form = $(formSelector);
    const checkboxContainer =
      formSelector === '#generatePaperForm' ? $('#generateChapterChecks') : $('#practiceChapterChecks');
    if (!form || (!form.elements.chapters && !checkboxContainer)) return;

    const render = () => {
      const classLevel = formValue(form, 'classLevel') || '9th';
      const subject = formValue(form, 'subject') || 'Physics';
      const chapters = syllabus[classLevel]?.[subject] || [];
      if (checkboxContainer) {
        checkboxContainer.innerHTML = chapters
          .map(
            (chapter, index) => `
              <label class="check-pill">
                <input type="checkbox" name="chapters" value="${escapeHtml(chapter)}" ${index === 0 ? 'checked' : ''}>
                ${escapeHtml(chapter)}
              </label>
            `
          )
          .join('');
      } else {
        form.elements.chapters.innerHTML = chapters
          .map((chapter) => `<option value="${escapeHtml(chapter)}">${escapeHtml(chapter)}</option>`)
          .join('');
      }
    };

    form.elements.classLevel?.addEventListener('change', render);
    form.elements.subject?.addEventListener('change', render);
    render();
  };

  const getChapterOptions = (classLevel, subject) => {
    const classes = classLevel ? [classLevel] : Object.keys(syllabus);
    const chapters = [];
    classes.forEach((level) => {
      const subjects = subject ? [subject] : Object.keys(syllabus[level] || {});
      subjects.forEach((item) => {
        chapters.push(...(syllabus[level]?.[item] || []));
      });
    });
    return [...new Set(chapters)];
  };

  const populateChapterDropdown = (select, { classLevel = '', subject = '', includeAll = false, selected = '' } = {}) => {
    if (!select) return;
    const chapters = getChapterOptions(classLevel, subject);
    select.innerHTML = [
      ...(includeAll ? ['<option value="">All chapters</option>'] : []),
      ...chapters.map((chapter) => `<option value="${escapeHtml(chapter)}">${escapeHtml(chapter)}</option>`)
    ].join('');
    if (selected && chapters.includes(selected)) {
      select.value = selected;
    } else if (!includeAll && chapters.length) {
      select.value = chapters[0];
    }
  };

  const initLogin = () => {
    $('#loginForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;

      try {
        const email = getEmailValue(form);
        const data = await api('/auth/login', {
          method: 'POST',
          body: {
            email,
            password: formValue(form, 'password')
          }
        });
        saveSession(data);
        redirectByRole(data.user.role);
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });
  };

  const initRegister = () => {
    $('#registerForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;

      try {
        const email = getEmailValue(form);
        const data = await api('/auth/register', {
          method: 'POST',
          body: {
            name: formValue(form, 'name'),
            email,
            password: formValue(form, 'password'),
            role: formValue(form, 'role')
          }
        });
        saveSession(data);
        redirectByRole(data.user.role);
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });
  };

  const statCard = (id, value) => {
    const node = $(id);
    if (node) node.textContent = value;
  };

  const money = (value) => `PKR ${Number(value || 0).toLocaleString()}`;

  const adminNavItems = [
    ['Core', '/dashboard/admin-dashboard.html', 'bi-speedometer2', 'Dashboard'],
    ['Core', '/admin/users.html', 'bi-people', 'Users'],
    ['Core', '/admin/subscriptions.html', 'bi-credit-card', 'Subscriptions', 'super'],
    ['Learning', '/admin/catalog.html', 'bi-diagram-3', 'Catalog'],
    ['Learning', '/admin/questions.html', 'bi-database', 'Question Bank'],
    ['Learning', '/admin/paper-logs.html', 'bi-journal-text', 'Paper Logs'],
    ['Learning', '/admin/chatbot-logs.html', 'bi-chat-dots', 'Chatbot Logs'],
    ['Library', '/admin/past-papers.html', 'bi-folder2-open', 'Past Papers & Books'],
    ['Finance', '/admin/payments.html', 'bi-receipt', 'Payments', 'super'],
    ['Finance', '/admin/reports.html', 'bi-file-earmark-bar-graph', 'Reports', 'super'],
    ['System', '/admin/analytics.html', 'bi-bar-chart', 'Analytics'],
    ['System', '/admin/settings.html', 'bi-gear', 'Settings', 'super']
  ];

  const initAdminChrome = () => {
    const { user } = getSession();
    const visibleAdminNavItems = adminNavItems.filter((item) => item[4] !== 'super' || isSuperAdminUser(user));
    const shell = $('.app-shell');
    if (shell) shell.classList.add('admin-shell');

    const sidebar = $('.sidebar');
    if (!sidebar) return;

    const activePath = window.location.pathname;
    const groups = visibleAdminNavItems.reduce((acc, item) => {
      acc[item[0]] = acc[item[0]] || [];
      acc[item[0]].push(item);
      return acc;
    }, {});

    sidebar.innerHTML = `
      <div class="brand"><img class="brand-logo" src="${appUrl('/assets/images/Logo.svg')}" alt="Paper Forge"><span class="brand-role">Admin</span></div>
      ${Object.entries(groups)
        .map(
          ([group, items]) => `
          <div class="sidebar-section">${group}</div>
          ${items
            .map(
              ([, href, icon, label]) =>
                `<a class="${activePath.endsWith(href) ? 'active' : ''}" href="${appUrl(href)}"><i class="bi ${icon}"></i> ${label}</a>`
            )
            .join('')}
        `
        )
        .join('')}
      <button class="js-logout"><i class="bi bi-box-arrow-left"></i> Logout</button>
    `;

    applyBrandHomeAttributes();
    normalizeInternalLinks(sidebar);
    wireLogout();

    $$('.admin-search input').forEach((input) => {
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        const query = input.value.toLowerCase();
        const match = visibleAdminNavItems.find((item) => item[3].toLowerCase().includes(query));
        if (match) window.location.href = match[1];
      });
    });
  };

  const renderMiniList = (selector, items, renderItem) => {
    const node = $(selector);
    if (!node) return;
    node.innerHTML = items.length ? items.map(renderItem).join('') : '<li class="admin-empty">No records yet</li>';
  };

  const setSuperAdminOnlyVisibility = (visible) => {
    $$('[data-super-admin-only]').forEach((node) => {
      node.hidden = !visible;
    });
  };

  const adminRecordName = (user, fallback = 'System record') => user?.name || user?.email || fallback;
  const adminLabel = (value, fallback = '-') =>
    String(value || fallback)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const statusLabel = (value, fallback = '-') => {
    const labels = {
      free_trial_used: 'Free Trial Used',
      trial_available: 'Trial Available'
    };
    return labels[value] || adminLabel(value, fallback);
  };
  const adminDate = (value, fallback = 'No date') => (value ? new Date(value).toLocaleDateString() : fallback);
  const adminStatusTone = (status) => {
    const value = String(status || '').toLowerCase();
    if (['succeeded', 'active', 'paid', 'completed'].includes(value)) return 'success';
    if (['failed', 'cancelled', 'expired', 'rejected'].includes(value)) return 'danger';
    if (['pending', 'free_trial_used', 'trial'].includes(value)) return 'warn';
    return 'neutral';
  };

  const downloadTextFile = (filename, text) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const initTeacherDashboard = async () => {
    const user = requireAuth(['teacher']);
    if (!user) return;
    wireDashboardSearch();

    try {
      const { stats } = await api('/teacher/stats');
      statCard('#totalPapers', stats.totalPapers);
      statCard('#aiPapers', stats.aiGeneratedPapers);
      statCard('#downloads', stats.downloads);
      statCard('#activityCount', stats.activity.length);
      const list = $('#teacherActivity');
      if (list) {
        list.innerHTML = stats.activity.length
          ? stats.activity
              .map(
                (paper) => `
                <li>
                  <div><strong>${escapeHtml(paper.title)}</strong><div class="muted">Generated paper</div></div>
                  <span class="pill-soft">${new Date(paper.createdAt).toLocaleDateString()}</span>
                </li>
              `
              )
              .join('')
          : '<li class="admin-empty">No papers yet</li>';
      }
    } catch (error) {
      showMessage(error.message, 'danger');
    }
  };

  const initGeneratePaper = () => {
    const user = requireAuth(['teacher', 'student', 'admin']);
    if (!user) return;
    adaptPaperShellForRole(user);

    wireChapterSelect('#generatePaperForm');

    const fullPaperCounts = {
      mcq: 100,
      short: 50,
      long: 20
    };

    const syncPaperMode = () => {
      const form = $('#generatePaperForm');
      if (!form) return;
      const isCustom = formValue(form, 'mode') !== 'full';
      [
        ['mcqCount', fullPaperCounts.mcq],
        ['shortCount', fullPaperCounts.short],
        ['longCount', fullPaperCounts.long]
      ].forEach(([name, fullValue]) => {
        const input = form.elements[name];
        if (!input) return;
        if (!isCustom) input.value = fullValue;
        input.disabled = !isCustom;
        input.closest('div')?.classList.toggle('muted', !isCustom);
      });
      updateMarksPreview();
    };

    const updateMarksPreview = () => {
      const form = $('#generatePaperForm');
      const container = $('#generateMarksPreview');
      if (!form || !container) return;

      const mode = formValue(form, 'mode') || 'custom';
      const marks = {
        mcq: Number(formValue(form, 'mcqMarks') || 1),
        short: Number(formValue(form, 'shortMarks') || 3),
        long: Number(formValue(form, 'longMarks') || 5)
      };

      if (mode === 'full') {
        const totals = {
          mcq: fullPaperCounts.mcq * marks.mcq,
          short: fullPaperCounts.short * marks.short,
          long: fullPaperCounts.long * marks.long
        };
        const grandTotal = totals.mcq + totals.short + totals.long;
        container.innerHTML = `
          <strong>Full paper marks:</strong>
          <span>MCQs ${fullPaperCounts.mcq}*${formatMarks(marks.mcq)}=${formatMarks(totals.mcq)}</span>
          <span>Short ${fullPaperCounts.short}*${formatMarks(marks.short)}=${formatMarks(totals.short)}</span>
          <span>Long ${fullPaperCounts.long}*${formatMarks(marks.long)}=${formatMarks(totals.long)}</span>
          <strong>Total = ${formatMarks(grandTotal)}</strong>
        `;
        return;
      }

      const counts = {
        mcq: Number(formValue(form, 'mcqCount') || 0),
        short: Number(formValue(form, 'shortCount') || 0),
        long: Number(formValue(form, 'longCount') || 0)
      };
      const totals = {
        mcq: counts.mcq * marks.mcq,
        short: counts.short * marks.short,
        long: counts.long * marks.long
      };
      const grandTotal = totals.mcq + totals.short + totals.long;
      container.innerHTML = `
        <strong>Total marks preview:</strong>
        <span>MCQs ${formatMarks(counts.mcq)}*${formatMarks(marks.mcq)}=${formatMarks(totals.mcq)}</span>
        <span>Short ${formatMarks(counts.short)}*${formatMarks(marks.short)}=${formatMarks(totals.short)}</span>
        <span>Long ${formatMarks(counts.long)}*${formatMarks(marks.long)}=${formatMarks(totals.long)}</span>
        <strong>Total = ${formatMarks(grandTotal)}</strong>
      `;
    };

    $('#generatePaperForm')?.elements.mode?.addEventListener('change', syncPaperMode);
    $('#generatePaperForm')?.addEventListener('input', updateMarksPreview);
    $('#generatePaperForm')?.addEventListener('change', updateMarksPreview);
    syncPaperMode();

    $('#generatePaperForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;

      try {
        const mode = formValue(form, 'mode') || 'custom';
        const payload = {
          title: formValue(form, 'title'),
          classLevel: formValue(form, 'classLevel'),
          subject: formValue(form, 'subject'),
          chapters: chapterValues(form),
          mode,
          schoolName: formValue(form, 'schoolName') || 'School / College Name',
          timeAllowed: formValue(form, 'timeAllowed') || '3 Hours',
          marksPerQuestion: {
            mcq: Number(formValue(form, 'mcqMarks') || 1),
            short: Number(formValue(form, 'shortMarks') || 3),
            long: Number(formValue(form, 'longMarks') || 5)
          }
        };

        if (mode !== 'full') {
          payload.mcqCount = Number(formValue(form, 'mcqCount') || 0);
          payload.shortCount = Number(formValue(form, 'shortCount') || 0);
          payload.longCount = Number(formValue(form, 'longCount') || 0);
        }

        const data = await api('/papers/generate', {
          method: 'POST',
          body: payload
        });
        localStorage.setItem('currentPaperId', data.paper._id);
        window.location.href = appUrl(`/teacher/preview-paper.html?id=${data.paper._id}`);
      } catch (error) {
        if (error.message.includes('Subscription required')) {
          window.location.href = appUrl('/subscription.html');
          return;
        }
        showMessage(error.message, 'danger');
      }
    });

    $('#resetGenerateForm')?.addEventListener('click', () => {
      $('#generatePaperForm')?.reset();
      syncPaperMode();
      updateMarksPreview();
    });
  };

  let previewPaper = null;
  let previewCanEdit = true;

  const paperChapterDetails = (paper = {}) => {
    if (Array.isArray(paper.chapterDetails) && paper.chapterDetails.length) return paper.chapterDetails;
    const names = paper.chapterNames?.length ? paper.chapterNames : paper.chapters || [];
    const numbers = paper.chapterNumbers || [];
    return names.map((chapterName, index) => ({
      chapterNumber: numbers[index],
      chapterName
    }));
  };

  const paperChapterNoText = (paper = {}) =>
    paperChapterDetails(paper).map((item) => item.chapterNumber).filter(Boolean).join(', ') || '-';

  const paperChapterNameText = (paper = {}) =>
    paperChapterDetails(paper).map((item) => item.chapterName).filter(Boolean).join(', ') || 'All';

  const renderPreviewPaper = () => {
    const container = $('#paperPreview');
    if (!container || !previewPaper) return;
    const mcqQuestions = previewPaper.questions.filter((question) => question.type === 'mcq');
    const previewTotalMarks = previewPaper.questions.reduce((sum, question) => sum + Number(question.marks || 0), 0);
    const sectionTitles = {
      mcq: 'SECTION A - MCQs',
      short: 'SECTION B - Short Questions',
      long: 'SECTION C - Long Questions'
    };

    container.innerHTML = `
      <div class="paper-sheet">
        <div class="text-center mb-4">
          <h2>${escapeHtml(previewPaper.title)}</h2>
          <p>Class: ${escapeHtml(previewPaper.classLevel)} | Subject: ${escapeHtml(previewPaper.subject)} | Marks: ${formatMarks(previewTotalMarks)}</p>
          <p>Chapter No: ${escapeHtml(paperChapterNoText(previewPaper))} | Chapter Name: ${escapeHtml(paperChapterNameText(previewPaper))}</p>
        </div>
        ${['mcq', 'short', 'long']
          .map((type) => {
            const items = previewPaper.questions
              .map((question, index) => ({ question, index }))
              .filter((item) => item.question.type === type);
            if (!items.length) return '';
            const stats = sectionStats(previewPaper, type, items.map((item) => item.question));
            return `
              <section class="mb-4">
                <h3 class="h5 text-decoration-underline section-heading">${sectionHeading(sectionTitles[type], stats)}</h3>
                ${items
                  .map(
                    ({ question, index }, sectionIndex) => `
                    <div class="preview-question" data-index="${index}">
                      ${
                        previewCanEdit
                          ? `<div class="question-actions">
                            <button class="btn btn-sm ${question.isImportant ? 'btn-warning' : 'btn-outline-warning'} js-toggle-important" title="Toggle important">IMP</button>
                            <button class="btn btn-sm btn-outline-primary js-edit-question">Edit</button>
                            <button class="btn btn-sm btn-outline-danger js-delete-question">Delete</button>
                          </div>`
                          : ''
                      }
                      <p><strong>${sectionIndex + 1}.</strong> ${importantStar(question)}${escapeHtml(cleanQuestionText(question.question))}</p>
                      ${(question.options || [])
                        .map((option, optionIndex) => `<div class="option-line">${String.fromCharCode(65 + optionIndex)}. ${escapeHtml(option)}</div>`)
                        .join('')}
                    </div>
                  `
                  )
                  .join('')}
              </section>
            `;
          })
          .join('')}
        ${
          mcqQuestions.length
            ? `<section class="mb-4">
                <h3 class="h5 text-decoration-underline">MCQ Answer Key</h3>
                <ol>
                  ${mcqQuestions
                    .map((question) => {
                      const optionIndex = (question.options || []).findIndex((option) => option === question.correctAnswer);
                      const label = optionIndex >= 0 ? `${String.fromCharCode(65 + optionIndex)}. ` : '';
                      return `<li>${escapeHtml(label)}${escapeHtml(question.correctAnswer || 'Teacher review required')}</li>`;
                    })
                    .join('')}
                </ol>
              </section>`
            : ''
        }
      </div>
    `;
  };

  const savePreviewPaper = async () => {
    if (!previewPaper) return;
    const typedQuestions = {
      mcq: previewPaper.questions.filter((question) => question.type === 'mcq'),
      short: previewPaper.questions.filter((question) => question.type === 'short'),
      long: previewPaper.questions.filter((question) => question.type === 'long')
    };
    const typeCounts = {
      mcq: typedQuestions.mcq.length,
      short: typedQuestions.short.length,
      long: typedQuestions.long.length
    };
    const sectionTotals = {
      mcq: typedQuestions.mcq.reduce((sum, question) => sum + Number(question.marks || 0), 0),
      short: typedQuestions.short.reduce((sum, question) => sum + Number(question.marks || 0), 0),
      long: typedQuestions.long.reduce((sum, question) => sum + Number(question.marks || 0), 0)
    };
    const marks = sectionTotals.mcq + sectionTotals.short + sectionTotals.long;
    const { paper } = await api(`/papers/${previewPaper._id}`, {
      method: 'PUT',
      body: {
        title: previewPaper.title,
        subject: previewPaper.subject,
        classLevel: previewPaper.classLevel,
        chapters: previewPaper.chapters,
        chapterNumbers: previewPaper.chapterNumbers,
        chapterNames: previewPaper.chapterNames,
        chapterDetails: previewPaper.chapterDetails,
        chapterNumber: previewPaper.chapterNumber,
        chapterName: previewPaper.chapterName,
        questions: previewPaper.questions,
        marks,
        marksPerQuestion: previewPaper.marksPerQuestion,
        sectionTotals,
        typeCounts
      }
    });
    previewPaper = paper;
    showMessage('Paper saved', 'success');
  };

  const initPreviewPaper = async () => {
    const user = requireAuth(['teacher', 'student', 'admin']);
    if (!user) return;
    adaptPaperShellForRole(user);
    previewCanEdit = user.role !== 'student';
    if (!previewCanEdit && $('#savePaperBtn')) $('#savePaperBtn').remove();
    if (!previewCanEdit) $('#manualPaperQuestionPanel')?.remove();

    const defaultMarksForManualType = (type) =>
      Number(previewPaper?.marksPerQuestion?.[type] || (type === 'long' ? 5 : type === 'short' ? 3 : 1));

    const syncManualPaperQuestionForm = () => {
      const form = $('#manualPaperQuestionForm');
      if (!form || !previewPaper) return;
      const type = formValue(form, 'type') || 'mcq';
      $$('.manual-mcq-field', form).forEach((field) => {
        field.hidden = type !== 'mcq';
      });
      if (form.elements.marks) {
        form.elements.marks.value = defaultMarksForManualType(type);
      }
    };

    const closeQuestionEditor = () => {
      const dialog = $('#questionEditDialog');
      if (!dialog) return;
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    };

    const editOptionsFromForm = () => {
      const form = $('#questionEditForm');
      if (!form) return [];
      return String(form.elements.options?.value || '')
        .split('\n')
        .map((option) => option.trim())
        .filter(Boolean);
    };

    const syncEditCorrectAnswerOptions = (preferredAnswer = '') => {
      const form = $('#questionEditForm');
      if (!form) return;
      const select = form.elements.correctAnswer;
      const options = editOptionsFromForm();
      const currentAnswer = preferredAnswer || select.value;
      select.innerHTML = options
        .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
        .join('');
      const matchingAnswer = options.find((option) => option.toLowerCase() === String(currentAnswer).toLowerCase());
      if (matchingAnswer) select.value = matchingAnswer;
    };

    const openQuestionEditor = (index) => {
      const dialog = $('#questionEditDialog');
      const form = $('#questionEditForm');
      const question = previewPaper?.questions?.[index];
      if (!dialog || !form || !question) return;

      form.reset();
      form.elements.questionIndex.value = index;
      form.elements.question.value = cleanQuestionText(question.question);
      form.elements.options.value = (question.options || []).join('\n');
      const isMcq = question.type === 'mcq';
      $('#questionEditMcqFields').hidden = !isMcq;
      form.elements.options.required = isMcq;
      form.elements.correctAnswer.required = isMcq;
      if (isMcq) syncEditCorrectAnswerOptions(question.correctAnswer || '');

      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      form.elements.question.focus();
    };

    const populateManualChapterOptions = () => {
      const form = $('#manualPaperQuestionForm');
      if (!form || !previewPaper) return;
      const select = form.elements.chapter;
      const chapters = previewPaper.chapters?.length
        ? previewPaper.chapters
        : [...new Set(previewPaper.questions.map((question) => question.chapter).filter(Boolean))];
      const options = chapters.length ? chapters : ['Manual'];
      select.innerHTML = options.map((chapter) => `<option value="${escapeHtml(chapter)}">${escapeHtml(chapter)}</option>`).join('');
      syncManualPaperQuestionForm();
    };

    const paperId = new URLSearchParams(window.location.search).get('id') || localStorage.getItem('currentPaperId');
    if (!paperId) {
      $('#manualPaperQuestionPanel')?.remove();
      $('#paperPreview').innerHTML = '<p class="muted">No paper selected.</p>';
      return;
    }

    try {
      const { paper } = await api(`/papers/${paperId}`);
      previewPaper = paper;
      populateManualChapterOptions();
      renderPreviewPaper();
    } catch (error) {
      $('#manualPaperQuestionPanel')?.remove();
      showMessage(error.message, 'danger');
    }

    $('#manualPaperQuestionForm')?.elements.type?.addEventListener('change', syncManualPaperQuestionForm);

    $('#manualPaperQuestionForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!previewPaper) return;

      const form = event.currentTarget;
      const type = formValue(form, 'type') || 'mcq';
      const questionText = cleanQuestionText(formValue(form, 'question'));
      const chapter = formValue(form, 'chapter') || previewPaper.chapters?.[0] || 'Manual';
      const manualChapterDetail =
        paperChapterDetails(previewPaper).find((item) => item.chapterName === chapter) || { chapterName: chapter };
      const marks = Number(formValue(form, 'marks') || defaultMarksForManualType(type));
      const options = formValue(form, 'options')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
      let correctAnswer = formValue(form, 'correctAnswer');

      if (!questionText) {
        showMessage('Question text is required.', 'danger');
        return;
      }

      if (type === 'mcq') {
        if (options.length < 2) {
          showMessage('MCQ needs at least two options.', 'danger');
          return;
        }
        const matchedAnswer = options.find((option) => option.toLowerCase() === correctAnswer.toLowerCase());
        if (!matchedAnswer) {
          showMessage('Correct answer must match one MCQ option exactly.', 'danger');
          return;
        }
        correctAnswer = matchedAnswer;
      }

      previewPaper.questions.push({
        questionId: null,
        classId: previewPaper.classId || previewPaper.classLevel,
        subjectId: previewPaper.subjectId || previewPaper.subject,
        chapterId: chapter,
        subject: previewPaper.subject,
        classLevel: previewPaper.classLevel,
        chapter,
        chapterNumber: manualChapterDetail.chapterNumber,
        chapterName: manualChapterDetail.chapterName || chapter,
        type,
        question: questionText,
        options: type === 'mcq' ? options : [],
        correctAnswer: type === 'mcq' ? correctAnswer : '',
        explanation: '',
        difficulty: 'medium',
        marks,
        isImportant: false
      });

      renderPreviewPaper();
      form.reset();
      populateManualChapterOptions();
      showMessage('Manual question added to this paper.', 'success');
    });

    $('#questionEditForm')?.elements.options?.addEventListener('input', () => {
      const currentAnswer = $('#questionEditForm')?.elements.correctAnswer?.value || '';
      syncEditCorrectAnswerOptions(currentAnswer);
    });

    $('#questionEditForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!previewPaper) return;

      const form = event.currentTarget;
      const index = Number(form.elements.questionIndex.value);
      const question = previewPaper.questions[index];
      const questionText = cleanQuestionText(formValue(form, 'question'));
      if (!question || !questionText) {
        showMessage('Question statement is required.', 'danger');
        return;
      }

      if (question.type === 'mcq') {
        const options = editOptionsFromForm();
        if (options.length < 2) {
          showMessage('MCQ needs at least two options.', 'danger');
          return;
        }
        const normalizedOptions = options.map((option) => option.toLowerCase());
        if (new Set(normalizedOptions).size !== options.length) {
          showMessage('MCQ options must be different from each other.', 'danger');
          return;
        }
        const selectedAnswer = formValue(form, 'correctAnswer');
        const correctAnswer = options.find((option) => option.toLowerCase() === selectedAnswer.toLowerCase());
        if (!correctAnswer) {
          showMessage('Select a correct answer from the updated MCQ options.', 'danger');
          return;
        }
        question.options = options;
        question.correctAnswer = correctAnswer;
      }

      question.question = questionText;
      renderPreviewPaper();
      closeQuestionEditor();
      showMessage('Question and options updated. Save the paper to keep these changes.', 'success');
    });

    $('#closeQuestionEditBtn')?.addEventListener('click', closeQuestionEditor);
    $('#cancelQuestionEditBtn')?.addEventListener('click', closeQuestionEditor);
    $('#questionEditDialog')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeQuestionEditor();
    });

    $('#paperPreview')?.addEventListener('click', async (event) => {
      const item = event.target.closest('.preview-question');
      if (!item || !previewPaper) return;
      const index = Number(item.dataset.index);

      if (event.target.matches('.js-delete-question')) {
        previewPaper.questions.splice(index, 1);
        renderPreviewPaper();
      }

      if (event.target.matches('.js-toggle-important')) {
        previewPaper.questions[index].isImportant = !previewPaper.questions[index].isImportant;
        renderPreviewPaper();
      }

      if (event.target.matches('.js-edit-question')) {
        openQuestionEditor(index);
      }

    });

    $('#savePaperBtn')?.addEventListener('click', async () => {
      try {
        await savePreviewPaper();
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });

    $('#downloadPdfBtn')?.addEventListener('click', async () => {
      try {
        if (previewCanEdit) await savePreviewPaper();
        await downloadFile(`/papers/${previewPaper._id}/download/pdf`, 'paper-forge.pdf');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });

    $('#downloadWordBtn')?.addEventListener('click', async () => {
      try {
        if (previewCanEdit) await savePreviewPaper();
        await downloadFile(`/papers/${previewPaper._id}/download/word`, 'paper-forge.docx');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });

    $('#printPaperBtn')?.addEventListener('click', () => {
      if (!previewPaper) return;
      const groups = ['mcq', 'short', 'long'];
      const titles = { mcq: 'SECTION A - MCQs', short: 'SECTION B - Short Questions', long: 'SECTION C - Long Questions' };
      const mcqQuestions = previewPaper.questions.filter((question) => question.type === 'mcq');
      const printTotalMarks = previewPaper.questions.reduce((sum, question) => sum + Number(question.marks || 0), 0);
      const html = `
        <html>
          <head>
            <title>${escapeHtml(previewPaper.title)}</title>
            <style>
              @page { size: A4; margin: 16mm; }
              body { font-family: "Times New Roman", Times, serif; color: #000; }
              .paper { border: 2px solid #000; padding: 18px; }
              header { text-align: center; border-bottom: 1px solid #000; margin-bottom: 14px; padding-bottom: 10px; }
              h2 { font-size: 15px; text-decoration: underline; }
              .meta { display: flex; justify-content: space-between; }
              .section-heading { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; }
              .section-formula { font-size: 13px; font-weight: 600; white-space: nowrap; }
              .question { break-inside: avoid; margin: 8px 0 12px; }
              .important-star { font-weight: 800; margin-right: 4px; }
              .options { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 18px; }
              .answer-key { break-before: page; }
              .answer-key li { margin-bottom: 6px; }
            </style>
          </head>
          <body>
            <main class="paper">
              <header>
                <h1>${escapeHtml(previewPaper.schoolName || 'School / College Name')}</h1>
                <div>${escapeHtml(previewPaper.examTitle || previewPaper.title)}</div>
                <div class="meta"><span>Class: ${escapeHtml(previewPaper.classLevel)}</span><span>Subject: ${escapeHtml(previewPaper.subject)}</span></div>
                <div class="meta"><span>Chapter No: ${escapeHtml(paperChapterNoText(previewPaper))}</span><span>Chapter Name: ${escapeHtml(paperChapterNameText(previewPaper))}</span></div>
                <div class="meta"><span>Time: ${escapeHtml(previewPaper.timeAllowed || '3 Hours')}</span><span>Total Marks: ${formatMarks(printTotalMarks)}</span></div>
              </header>
              ${groups
                .map((type) => {
                  const items = previewPaper.questions.filter((question) => question.type === type);
                  if (!items.length) return '';
                  const stats = sectionStats(previewPaper, type, items);
                  return `<section><h2 class="section-heading">${sectionHeading(titles[type], stats)}</h2>${items
                    .map(
                      (question, index) => `<div class="question"><p><strong>${index + 1}.</strong> ${importantStar(question)}${escapeHtml(cleanQuestionText(question.question))}</p>${
                        type === 'mcq'
                          ? `<div class="options">${(question.options || [])
                              .slice(0, 4)
                              .map((option, optionIndex) => `<span>(${String.fromCharCode(65 + optionIndex)}) ${escapeHtml(option)}</span>`)
                              .join('')}</div>`
                          : ''
                      }</div>`
                    )
                    .join('')}</section>`;
                })
                .join('')}
              ${
                mcqQuestions.length
                  ? `<section class="answer-key"><h2>MCQ Answer Key</h2><ol>${mcqQuestions
                      .map((question) => {
                        const optionIndex = (question.options || []).findIndex((option) => option === question.correctAnswer);
                        const label = optionIndex >= 0 ? `${String.fromCharCode(65 + optionIndex)}. ` : '';
                        return `<li>${escapeHtml(label)}${escapeHtml(question.correctAnswer || 'Teacher review required')}</li>`;
                      })
                      .join('')}</ol></section>`
                  : ''
              }
            </main>
          </body>
        </html>`;
      const printWindow = window.open('', '_blank');
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    });
  };

  const initPaperHistory = async () => {
    const user = requireAuth(['teacher', 'student', 'admin']);
    if (!user) return;
    adaptPaperShellForRole(user);

    const table = $('#paperHistoryBody');
    try {
      const { papers } = await api('/papers');
      table.innerHTML = papers
        .map(
          (paper) => `
            <tr>
              <td>${escapeHtml(paper.title)}</td>
              <td>${escapeHtml(paper.subject)}</td>
              <td>${escapeHtml(paper.classLevel)}</td>
              <td>${paper.questions.length}</td>
              <td>${new Date(paper.createdAt).toLocaleDateString()}</td>
              <td class="table-actions">
                <a class="btn btn-sm btn-outline-primary" href="${appUrl(`/teacher/preview-paper.html?id=${paper._id}`)}">View</a>
                ${user.role === 'student' ? '' : `<button class="btn btn-sm btn-outline-danger js-delete-paper" data-id="${paper._id}">Delete</button>`}
              </td>
            </tr>
          `
        )
        .join('');
    } catch (error) {
      showMessage(error.message, 'danger');
    }

    table?.addEventListener('click', async (event) => {
      if (!event.target.matches('.js-delete-paper')) return;
      if (!confirm('Delete this paper?')) return;

      try {
        await api(`/papers/${event.target.dataset.id}`, { method: 'DELETE' });
        event.target.closest('tr').remove();
        showMessage('Paper deleted', 'success');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });
  };

  const initStudentDashboard = async () => {
    const user = requireAuth(['student']);
    if (!user) return;
    wireDashboardSearch();

    try {
      const { stats } = await api('/student/stats');
      statCard('#studentAttempts', stats.attempts);
      statCard('#studentAverage', `${stats.averageScore}%`);
      statCard('#studentInProgress', stats.inProgress);
      const list = $('#recentAttempts');
      if (list) {
        const recentAttempts = Array.isArray(stats.recentAttempts) ? stats.recentAttempts : [];
        statCard('#studentRecentCount', `${recentAttempts.length} ${recentAttempts.length === 1 ? 'attempt' : 'attempts'}`);
        list.innerHTML = recentAttempts.length
          ? recentAttempts
              .map(
                (practice) => {
                  const isSubmitted = practice.status === 'submitted';
                  const subject = practice.filters?.subject || 'Practice Test';
                  const classLevel = practice.filters?.classLevel || 'Practice';
                  const chapters = (practice.filters?.chapters || []).join(', ') || 'All chapters';
                  const scorePercent =
                    isSubmitted && practice.totalMarks
                      ? Math.round((Number(practice.score || 0) / Number(practice.totalMarks)) * 100)
                      : null;
                  const date = practice.createdAt ? new Date(practice.createdAt).toLocaleDateString() : '';
                  const target = isSubmitted
                    ? `/student/result.html?id=${practice._id}`
                    : `/student/practice-test.html?id=${practice._id}`;

                  return `
              <li class="student-attempt-item">
                <span class="student-attempt-icon ${isSubmitted ? 'is-complete' : 'is-active'}">
                  <i class="bi ${isSubmitted ? 'bi-check2' : 'bi-play-fill'}"></i>
                </span>
                <div class="student-attempt-copy">
                  <strong>${escapeHtml(subject)}</strong>
                  <span>${escapeHtml(classLevel)} <span aria-hidden="true">•</span> ${escapeHtml(chapters)}</span>
                </div>
                <div class="student-attempt-meta">
                  <span class="student-attempt-status ${isSubmitted ? 'is-complete' : 'is-active'}">
                    ${isSubmitted ? `${scorePercent}% score` : 'In progress'}
                  </span>
                  ${date ? `<small>${escapeHtml(date)}</small>` : ''}
                </div>
                <a href="${appUrl(target)}" class="student-attempt-action">
                  ${isSubmitted ? 'Review' : 'Continue'} <i class="bi bi-arrow-right"></i>
                </a>
              </li>
            `;
                }
              )
              .join('')
          : `
              <li class="student-attempt-empty">
                <span><i class="bi bi-clipboard2-check"></i></span>
                <div>
                  <strong>No practice attempts yet</strong>
                  <p>Start a chapter-wise practice test to see your progress here.</p>
                </div>
                <a class="btn btn-outline-primary" href="${appUrl('/student/practice-setup.html')}">Start practice</a>
              </li>
            `;
      }
    } catch (error) {
      showMessage(error.message, 'danger');
    }
  };

  const initPracticeSetup = () => {
    const user = requireAuth(['student']);
    if (!user) return;

    wireChapterSelect('#practiceSetupForm');

    $('#practiceSetupForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;

      try {
        const { practice } = await api('/student/practice/generate', {
          method: 'POST',
          body: {
            classLevel: formValue(form, 'classLevel'),
            subject: formValue(form, 'subject'),
            chapters: chapterValues(form),
            count: Number(formValue(form, 'count') || 10)
          }
        });
        localStorage.setItem(`practiceStartedAt:${practice._id}`, String(Date.now()));
        window.location.href = appUrl(`/student/practice-test.html?id=${practice._id}`);
      } catch (error) {
        if (error.message.includes('Subscription required')) {
          window.location.href = appUrl('/subscription.html');
          return;
        }
        showMessage(error.message, 'danger');
      }
    });
  };

  const renderChatbotPaperPreview = (paper) => {
    const container = $('#chatbotPreview');
    if (!container || !paper) return;
    const groups = {
      mcq: paper.questions.filter((question) => question.type === 'mcq'),
      short: paper.questions.filter((question) => question.type === 'short'),
      long: paper.questions.filter((question) => question.type === 'long')
    };
    const sectionLabels = {
      mcq: 'MCQs',
      short: 'Short Questions',
      long: 'Long Questions'
    };
    const totalMarks = paper.questions.reduce((sum, question) => sum + Number(question.marks || 0), 0);

    container.innerHTML = `
      <div class="chatbot-preview-head">
        <div>
          <span class="pill-soft">Generated Paper</span>
          <h2>${escapeHtml(paper.title || 'AI Chat Paper')}</h2>
          <p>${escapeHtml(paper.classLevel)} / ${escapeHtml(paper.subject)} / ${formatMarks(totalMarks)} marks</p>
        </div>
        <a class="btn btn-outline-primary" href="${appUrl(`/teacher/preview-paper.html?id=${paper._id}`)}"><i class="bi bi-file-earmark-text"></i> Open Preview</a>
      </div>
      ${['mcq', 'short', 'long']
        .map((type) => {
          const items = groups[type] || [];
          if (!items.length) return '';
          return `
            <section class="chatbot-preview-section">
              <h3>${sectionLabels[type]}</h3>
              ${items
                .slice(0, 8)
                .map(
                  (question, index) => `
                    <div class="chatbot-question-row">
                      <strong>${index + 1}.</strong>
                      <div>
                        <p>${escapeHtml(cleanQuestionText(question.question))}</p>
                        ${
                          type === 'mcq'
                            ? `<div class="chatbot-options">${(question.options || [])
                                .slice(0, 4)
                                .map((option, optionIndex) => `<span>${String.fromCharCode(65 + optionIndex)}. ${escapeHtml(option)}</span>`)
                                .join('')}</div>`
                            : ''
                        }
                      </div>
                    </div>
                  `
                )
                .join('')}
              ${items.length > 8 ? `<div class="muted">Showing first 8 of ${items.length} ${sectionLabels[type].toLowerCase()}.</div>` : ''}
            </section>
          `;
        })
        .join('')}
    `;
  };

  const renderChatbotPracticePreview = (practice) => {
    const container = $('#chatbotPreview');
    if (!container || !practice) return;
    localStorage.setItem(`practiceStartedAt:${practice._id}`, String(Date.now()));
    container.innerHTML = `
      <div class="chatbot-preview-head">
        <div>
          <span class="pill-soft">Generated Practice</span>
          <h2>${escapeHtml(practice.filters?.subject || 'Practice Paper')}</h2>
          <p>${escapeHtml(practice.filters?.classLevel || '')} / ${escapeHtml((practice.filters?.chapters || []).join(', '))} / ${practice.questions.length} MCQs</p>
        </div>
        <a class="btn btn-primary" href="${appUrl(`/student/practice-test.html?id=${practice._id}`)}"><i class="bi bi-play-fill"></i> Start Practice</a>
      </div>
      <section class="chatbot-preview-section">
        ${practice.questions
          .slice(0, 12)
          .map(
            (question, index) => `
              <div class="chatbot-question-row">
                <strong>${index + 1}.</strong>
                <div>
                  <p>${escapeHtml(cleanQuestionText(question.question))}</p>
                  <div class="chatbot-options">${(question.options || [])
                    .slice(0, 4)
                    .map((option, optionIndex) => `<span>${String.fromCharCode(65 + optionIndex)}. ${escapeHtml(option)}</span>`)
                    .join('')}</div>
                </div>
              </div>
            `
          )
          .join('')}
        ${practice.questions.length > 12 ? `<div class="muted">Showing first 12 of ${practice.questions.length} MCQs.</div>` : ''}
      </section>
    `;
  };

  const renderChatbotList = (title, items) => {
    const container = $('#chatbotPreview');
    if (!container) return;
    container.innerHTML = `
      <div class="chatbot-preview-head">
        <div>
          <span class="pill-soft">AI Result</span>
          <h2>${escapeHtml(title)}</h2>
        </div>
      </div>
      <section class="chatbot-preview-section">
        <ol class="chatbot-result-list">
          ${(items || []).map((item) => `<li>${escapeHtml(typeof item === 'string' ? item : `${item.number}. ${item.answer}`)}</li>`).join('')}
        </ol>
      </section>
    `;
  };

  const renderChatbotEmptyState = (chatRole) => {
    const preview = $('#chatbotPreview');
    if (preview) {
      preview.innerHTML = `<div class="admin-empty">${
        chatRole === 'teacher'
          ? 'Generated paper preview will appear here.'
          : 'Generated practice preview or AI answer will appear here.'
      }</div>`;
    }
    const parsed = $('#chatbotParsed');
    if (parsed) {
      parsed.innerHTML = `
        <div class="panel-title mb-2">
          <h3>AI Parsed JSON</h3>
          <span class="pill-soft">Waiting</span>
        </div>
        <pre>{}</pre>
      `;
    }
  };

  const summaryValue = (value, fallback = '-') => {
    if (Array.isArray(value)) return value.length ? value.join(', ') : fallback;
    return value || fallback;
  };

  const renderChatbotConfirmation = (data) => {
    const container = $('#chatbotPreview');
    if (!container) return;
    const summary = data.summary || {};
    const counts = summary.counts || {};
    const marks = summary.marks || {};
    const isPracticeConfirmation = summary.intent === 'generate_practice';
    const confirmationQuestion =
      data.confirmationQuestion || `Generate this ${summary.intent === 'generate_practice' ? 'practice test' : 'paper'}?`;
    const countText =
      Object.entries(counts)
        .map(([type, value]) => `${adminLabel(type)}: ${value}`)
        .join(' / ') || '-';
    const markFields = isPracticeConfirmation
      ? [{ type: 'mcq', label: 'MCQ', value: marks.mcq || 1 }]
      : [
          { type: 'mcq', label: 'MCQ', value: marks.mcq || 1 },
          { type: 'short', label: 'Short', value: marks.short || 2 },
          { type: 'long', label: 'Long', value: marks.long || 5 }
        ];
    const marksTitle = isPracticeConfirmation ? 'MCQ Marks' : 'Marks';

    container.innerHTML = `
      <div class="chatbot-confirmation-card">
        <span class="pill-soft">Confirmation required</span>
        <h2>${escapeHtml(confirmationQuestion)}</h2>
        <p>Review summary first. Reply yes to generate, no/cancel to clear, or edit details to update.</p>
        <div class="chatbot-summary-grid">
          <div><span>Class</span><strong>${escapeHtml(summaryValue(summary.classLevel))}</strong></div>
          <div><span>Subject</span><strong>${escapeHtml(summaryValue(summary.subject))}</strong></div>
          <div><span>Chapter Mode</span><strong>${escapeHtml(summary.fullBook ? 'Full Book' : summary.firstHalf ? 'First Half Book' : summary.secondHalf ? 'Second Half Book' : summary.chapterRange ? 'Chapter Range' : summaryValue(summary.chapterMode, 'Selected Chapters'))}</strong></div>
          <div><span>Chapter No</span><strong>${escapeHtml(summaryValue(summary.chapterNumbers || summary.chapterNumber))}</strong></div>
          <div><span>Chapter Name</span><strong>${escapeHtml(summaryValue(summary.chapterNames || summary.chapters || summary.chapterName))}</strong></div>
          <div><span>Counts</span><strong>${escapeHtml(countText)}</strong></div>
          <div class="chatbot-marks-card">
            <span>${escapeHtml(marksTitle)}</span>
            <div class="chatbot-marks-editor ${isPracticeConfirmation ? 'chatbot-marks-editor-single' : ''}">
              ${markFields
                .map(
                  (field) => `
                    <label>
                      <small>${escapeHtml(field.label)}</small>
                      <input class="form-control js-chatbot-mark" data-mark-type="${escapeHtml(field.type)}" type="number" min="1" step="1" value="${escapeHtml(field.value)}">
                    </label>
                  `
                )
                .join('')}
            </div>
          </div>
        </div>
        <div class="chatbot-confirm-actions">
          <button class="btn btn-primary js-chatbot-confirm" type="button"><i class="bi bi-check2-circle"></i> Yes, Generate</button>
          <button class="btn btn-outline-secondary js-chatbot-edit" type="button"><i class="bi bi-pencil"></i> Edit Details</button>
          <button class="btn btn-outline-danger js-chatbot-cancel" type="button"><i class="bi bi-x-circle"></i> No, Cancel</button>
        </div>
      </div>
    `;
  };

  const appendChatMessage = (role, content) => {
    const feed = $('#chatbotFeed');
    if (!feed) return;
    const node = document.createElement('div');
    node.className = `chat-message chat-message-${role}`;
    node.innerHTML = `<div>${escapeHtml(content)}</div>`;
    feed.appendChild(node);
    feed.scrollTop = feed.scrollHeight;
  };

  const appendTypingIndicator = () => {
    const feed = $('#chatbotFeed');
    if (!feed) return null;
    const node = document.createElement('div');
    node.className = 'chat-message chat-message-bot chat-message-typing';
    node.innerHTML = `
      <div class="typing-dots" aria-label="Paper Forge is thinking">
        <span></span><span></span><span></span>
      </div>
    `;
    feed.appendChild(node);
    feed.scrollTop = feed.scrollHeight;
    return node;
  };

  const removeTypingIndicator = (node) => {
    if (node?.parentNode) node.parentNode.removeChild(node);
  };

  const renderParsedCommand = (parsed) => {
    const container = $('#chatbotParsed');
    if (!container || !parsed) return;
    container.innerHTML = `
      <div class="panel-title mb-2">
        <h3>AI Parsed JSON</h3>
        <span class="pill-soft">${escapeHtml(parsed.intent || 'unknown')}</span>
      </div>
      <pre>${escapeHtml(JSON.stringify(parsed, null, 2))}</pre>
    `;
  };

  const initChatbot = () => {
    const chatRole = document.body.dataset.chatRole || 'student';
    const allowedRoles = chatRole === 'teacher' ? ['teacher', 'admin'] : ['student', 'admin'];
    const user = requireAuth(allowedRoles);
    if (!user) return;

    let currentPaper = null;
    const form = $('#chatbotForm');
    const input = $('#chatbotInput');
    const sendButton = $('#chatbotSendBtn');
    const exportPdf = $('#chatbotExportPdf');
    const exportWord = $('#chatbotExportWord');
    const resetButton = $('#chatbotResetBtn');
    const preview = $('#chatbotPreview');
    const initialSendHtml = sendButton?.innerHTML || '<i class="bi bi-send"></i> Send Command';

    const syncExportButtons = () => {
      [exportPdf, exportWord].forEach((button) => {
        if (button) button.disabled = !currentPaper;
      });
    };

    const setChatbotLoading = (loading) => {
      if (sendButton) {
        sendButton.disabled = loading;
        sendButton.innerHTML = loading
          ? '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Processing'
          : initialSendHtml;
      }
      if (resetButton) resetButton.disabled = loading;
    };

    const handleChatbotData = (data) => {
      renderParsedCommand(data.parsed);
      appendChatMessage('bot', data.message || 'Done.');

      if (data.confirmationRequired || data.action === 'confirm_generation') {
        renderChatbotConfirmation(data);
        return;
      }

      if (data.paper) {
        currentPaper = data.paper;
        localStorage.setItem('currentPaperId', data.paper._id);
        renderChatbotPaperPreview(data.paper);
      }

      if (data.practice) {
        currentPaper = null;
        renderChatbotPracticePreview(data.practice);
      }

      if (data.answerKey) {
        renderChatbotList('MCQ Answer Key', data.answerKey);
      }

      if (data.studyPlan) {
        renderChatbotList('Study Plan', data.studyPlan);
      }

      if (data.analysis) {
        renderChatbotList('Weak Topic Analysis', data.analysis);
      }

      if (data.reset || data.cancelled) {
        currentPaper = null;
        localStorage.removeItem('currentPaperId');
        renderChatbotEmptyState(chatRole);
      }
    };

    const sendChatMessage = async (message, displayText = message, extraContext = {}) => {
      const cleanMessage = String(message || '').trim();
      if (!cleanMessage) return;

      appendChatMessage('user', displayText);
      const typingNode = appendTypingIndicator();
      setChatbotLoading(true);

      try {
        const data = await api('/chatbot/message', {
          method: 'POST',
          body: {
            message: cleanMessage,
            context: {
              ...extraContext,
              paperId: currentPaper?._id || localStorage.getItem('currentPaperId') || ''
            }
          }
        });
        removeTypingIndicator(typingNode);
        handleChatbotData(data);
        syncExportButtons();
      } catch (error) {
        removeTypingIndicator(typingNode);
        if (error.message.includes('Subscription required')) {
          window.location.href = appUrl('/subscription.html');
          return;
        }
        appendChatMessage('bot', error.message);
        showMessage(error.message, 'danger');
      } finally {
        setChatbotLoading(false);
      }
    };

    $$('.chatbot-example').forEach((button) => {
      button.addEventListener('click', () => {
        if (input) input.value = button.dataset.prompt || '';
        input?.focus();
      });
    });

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = input?.value.trim();
      if (!message) return;

      input.value = '';
      await sendChatMessage(message);
    });

    preview?.addEventListener('click', async (event) => {
      if (event.target.closest('.js-chatbot-confirm')) {
        const editedMarks = Object.fromEntries(
          $$('.js-chatbot-mark', preview).map((input) => [
            input.dataset.markType,
            Math.max(Number(input.value || 0), 1)
          ])
        );
        await sendChatMessage('yes', 'Yes, generate it.', { marks: editedMarks });
        return;
      }
      if (event.target.closest('.js-chatbot-cancel')) {
        await sendChatMessage('no', 'No, cancel.');
        return;
      }
      if (!event.target.closest('.js-chatbot-edit')) return;
      await sendChatMessage('edit', 'Edit details');
      input?.focus();
    });

    resetButton?.addEventListener('click', async () => {
      try {
        const data = await api('/chatbot/reset', { method: 'POST' });
        const feed = $('#chatbotFeed');
        if (feed) feed.innerHTML = '';
        currentPaper = null;
        localStorage.removeItem('currentPaperId');
        renderChatbotEmptyState(chatRole);
        appendChatMessage('bot', data.message || 'Chat cleared.');
        syncExportButtons();
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });

    exportPdf?.addEventListener('click', async () => {
      if (!currentPaper) return;
      try {
        await downloadFile(`/papers/${currentPaper._id}/download/pdf`, 'paper-forge-ai-paper.pdf');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });

    exportWord?.addEventListener('click', async () => {
      if (!currentPaper) return;
      try {
        await downloadFile(`/papers/${currentPaper._id}/download/word`, 'paper-forge-ai-paper.docx');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });

    appendChatMessage(
      'bot',
      chatRole === 'teacher'
        ? 'Tell me the class, subject, chapters, and question counts. I will parse it first, then generate the paper.'
        : 'Ask me to make chapter-wise MCQ practice or explain an answer.'
    );
    syncExportButtons();
  };

  let practiceState = {
    practice: null,
    index: 0,
    answers: {},
    flaggedQuestions: new Set(),
    timerId: null,
    timerHidden: false,
    isSubmitting: false
  };

  const finishPractice = async () => {
    if (practiceState.isSubmitting) return;
    practiceState.isSubmitting = true;
    if (practiceState.timerId) window.clearInterval(practiceState.timerId);
    try {
      saveCurrentPracticeAnswer();
      const { practice, answers } = practiceState;
      const startedAt = Number(localStorage.getItem(`practiceStartedAt:${practice._id}`) || Date.now());
      const timeTaken = Math.floor((Date.now() - startedAt) / 1000);

      await api(`/student/practice/${practice._id}/submit`, {
        method: 'POST',
        body: {
          timeTaken,
          answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }))
        }
      });
      localStorage.removeItem(`practiceStartedAt:${practice._id}`);
      localStorage.removeItem(`practiceAnswers:${practice._id}`);
      window.location.href = `/student/result.html?id=${practice._id}`;
    } catch (error) {
      practiceState.isSubmitting = false;
      showMessage(error.message, 'danger');
    }
  };

  const goToNextPracticeQuestion = async () => {
    saveCurrentPracticeAnswer();
    if (practiceState.index >= practiceState.practice.questions.length - 1) {
      return;
    }
    practiceState.index += 1;
    renderPracticeQuestion();
  };

  const practiceQuestionId = (question) => String(question?._id || '');

  const renderPracticeMeta = () => {
    const { practice, index, answers, flaggedQuestions } = practiceState;
    const meta = $('#practiceMeta');
    if (!practice || !meta) return;

    const question = practice.questions[index];
    const questionId = practiceQuestionId(question);
    const isAnswered = Boolean(String(answers[questionId] || '').trim());
    const isFlagged = flaggedQuestions.has(questionId);
    const marks = Number(question.marks || 1);

    meta.innerHTML = `
      <div class="practice-question-status">
        <span>Question ${index + 1}</span>
        <strong>${isAnswered ? 'Answered' : 'Not yet answered'}</strong>
      </div>
      <div class="practice-question-mark">
        <span>Marked out of</span>
        <strong>${marks.toFixed(2)}</strong>
      </div>
      <button class="practice-flag-button ${isFlagged ? 'is-flagged' : ''}" id="flagQuestionBtn" type="button" aria-pressed="${isFlagged}">
        <i class="bi ${isFlagged ? 'bi-flag-fill' : 'bi-flag'}" aria-hidden="true"></i>
        ${isFlagged ? 'Flagged' : 'Flag question'}
      </button>
    `;
  };

  const renderPracticeQuestion = () => {
    const { practice, index, answers } = practiceState;
    const container = $('#practiceQuestion');
    if (!practice || !container) return;
    const question = practice.questions[index];
    const questionId = practiceQuestionId(question);
    const questionCount = practice.questions.length;
    const progress = ((index + 1) / questionCount) * 100;

    container.innerHTML = `
      <span class="practice-question-kicker">Choose the correct answer</span>
      <h1 id="practiceQuestionHeading">${escapeHtml(question.question)}</h1>
      ${
        question.type === 'mcq'
          ? `
              <div class="practice-answer-options">
                ${(question.options || [])
                  .map(
                    (option, optionIndex) => `
                      <label class="answer-option">
                        <input type="radio" name="answer" value="${escapeHtml(option)}" ${answers[questionId] === option ? 'checked' : ''}>
                        <span class="answer-option-letter">${String.fromCharCode(65 + optionIndex)}</span>
                        <span class="answer-option-text">${escapeHtml(option)}</span>
                      </label>
                    `
                  )
                  .join('')}
              </div>
              <button class="practice-clear-choice" id="clearPracticeChoiceBtn" type="button" ${answers[questionId] ? '' : 'hidden'}>
                <i class="bi bi-x-circle" aria-hidden="true"></i>
                Clear my choice
              </button>
            `
          : `<textarea class="form-control practice-written-answer" name="answer" rows="6" placeholder="Write your answer">${escapeHtml(answers[questionId] || '')}</textarea>`
      }
    `;

    const progressText = $('#practiceProgressText');
    const progressBar = $('#practiceProgressBar');
    const previousButton = $('#prevQuestionBtn');
    const nextButton = $('#nextQuestionBtn');
    const submitButton = $('#submitPracticeBtn');

    if (progressText) progressText.textContent = `Question ${index + 1} of ${questionCount}`;
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (previousButton) previousButton.disabled = index === 0;
    if (nextButton) nextButton.hidden = index === questionCount - 1;
    if (submitButton) submitButton.hidden = index !== questionCount - 1;
    renderPracticeMeta();
  };

  const saveCurrentPracticeAnswer = () => {
    const { practice, index, answers } = practiceState;
    if (!practice) return;
    const question = practice.questions[index];
    const questionId = practiceQuestionId(question);
    const checked = $('input[name="answer"]:checked');
    const text = $('textarea[name="answer"]');
    answers[questionId] = checked?.value || text?.value || '';
    localStorage.setItem(`practiceAnswers:${practice._id}`, JSON.stringify(answers));
  };

  const clearCurrentPracticeChoice = () => {
    const { practice, index, answers } = practiceState;
    if (!practice) return;
    const questionId = practiceQuestionId(practice.questions[index]);
    delete answers[questionId];
    localStorage.setItem(`practiceAnswers:${practice._id}`, JSON.stringify(answers));
    renderPracticeQuestion();
  };

  const openPracticeFinishDialog = () => {
    saveCurrentPracticeAnswer();
    const { practice, answers, flaggedQuestions } = practiceState;
    const dialog = $('#practiceFinishDialog');
    const summary = $('#practiceAttemptSummary');
    if (!practice || !dialog || !summary) return;

    const answeredCount = practice.questions.filter((question) =>
      Boolean(String(answers[practiceQuestionId(question)] || '').trim())
    ).length;
    const totalCount = practice.questions.length;
    const unansweredCount = totalCount - answeredCount;

    summary.innerHTML = `
      <div>
        <span>Answered</span>
        <strong>${answeredCount}</strong>
      </div>
      <div>
        <span>Unanswered</span>
        <strong>${unansweredCount}</strong>
      </div>
      <div>
        <span>Flagged</span>
        <strong>${flaggedQuestions.size}</strong>
      </div>
    `;

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  };

  const closePracticeFinishDialog = () => {
    const dialog = $('#practiceFinishDialog');
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  };

  const toggleCurrentPracticeFlag = () => {
    const { practice, index, flaggedQuestions } = practiceState;
    if (!practice) return;
    const questionId = practiceQuestionId(practice.questions[index]);
    if (flaggedQuestions.has(questionId)) {
      flaggedQuestions.delete(questionId);
    } else {
      flaggedQuestions.add(questionId);
    }
    localStorage.setItem(`practiceFlags:${practice._id}`, JSON.stringify([...flaggedQuestions]));
    renderPracticeMeta();
  };

  const formatDuration = (totalSeconds) => {
    const safeSeconds = Math.max(0, Number(totalSeconds || 0));
    const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
    const seconds = String(safeSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const practiceDurationSeconds = (practice) =>
    Number(practice?.durationSeconds || 0) || Number(practice?.questions?.length || 0) * 60;

  const startPracticeTimer = () => {
    if (practiceState.timerId) window.clearInterval(practiceState.timerId);
    const practice = practiceState.practice;
    if (!practice) return;
    const duration = practiceDurationSeconds(practice);
    const timer = $('#practiceTimer');
    const timerPanel = $('#practiceTimerPanel');

    const startedAtKey = `practiceStartedAt:${practice._id}`;
    const startedAt = Number(localStorage.getItem(startedAtKey) || Date.now());
    localStorage.setItem(startedAtKey, String(startedAt));

    practiceState.timerId = window.setInterval(async () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      if (timer) {
        timer.textContent = formatDuration(remaining);
      }
      timerPanel?.classList.toggle('is-urgent', remaining <= 60);
      if (remaining <= 0) {
        window.clearInterval(practiceState.timerId);
        await finishPractice();
      }
    }, 1000);

    if (timer) {
      const remaining = Math.max(0, duration - Math.floor((Date.now() - startedAt) / 1000));
      timer.textContent = formatDuration(remaining);
      timerPanel?.classList.toggle('is-urgent', remaining <= 60);
    }
  };

  const initPracticeTest = async () => {
    const user = requireAuth(['student']);
    if (!user) return;
    const practiceId = new URLSearchParams(window.location.search).get('id');
    if (!practiceId) return;

    try {
      const { practice } = await api(`/student/practice/${practiceId}`);
      practiceState.practice = practice;
      practiceState.answers = JSON.parse(localStorage.getItem(`practiceAnswers:${practiceId}`) || '{}');
      practiceState.flaggedQuestions = new Set(
        JSON.parse(localStorage.getItem(`practiceFlags:${practiceId}`) || '[]')
      );
      renderPracticeQuestion();
      if (!localStorage.getItem(`practiceStartedAt:${practiceId}`)) {
        localStorage.setItem(`practiceStartedAt:${practiceId}`, String(Date.now()));
      }
      startPracticeTimer();
    } catch (error) {
      showMessage(error.message, 'danger');
    }

    $('#prevQuestionBtn')?.addEventListener('click', () => {
      saveCurrentPracticeAnswer();
      practiceState.index -= 1;
      renderPracticeQuestion();
    });

    $('#nextQuestionBtn')?.addEventListener('click', async () => {
      await goToNextPracticeQuestion();
    });

    $('#submitPracticeBtn')?.addEventListener('click', () => {
      openPracticeFinishDialog();
    });

    $('#confirmPracticeSubmitBtn')?.addEventListener('click', async () => {
      try {
        closePracticeFinishDialog();
        await finishPractice();
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });

    $('#closePracticeFinishBtn')?.addEventListener('click', closePracticeFinishDialog);
    $('#returnToPracticeBtn')?.addEventListener('click', closePracticeFinishDialog);

    $('#practiceQuestion')?.addEventListener('change', (event) => {
      if (event.target.matches('input[name="answer"]')) {
        saveCurrentPracticeAnswer();
        const clearButton = $('#clearPracticeChoiceBtn');
        if (clearButton) clearButton.hidden = false;
        renderPracticeMeta();
      }
    });

    $('#practiceQuestion')?.addEventListener('click', (event) => {
      if (event.target.closest('#clearPracticeChoiceBtn')) clearCurrentPracticeChoice();
    });

    $('#practiceQuestion')?.addEventListener('input', (event) => {
      if (event.target.matches('textarea[name="answer"]')) {
        saveCurrentPracticeAnswer();
        renderPracticeMeta();
      }
    });

    $('#practiceMeta')?.addEventListener('click', (event) => {
      if (event.target.closest('#flagQuestionBtn')) toggleCurrentPracticeFlag();
    });

    $('#toggleTimerBtn')?.addEventListener('click', () => {
      practiceState.timerHidden = !practiceState.timerHidden;
      const panel = $('#practiceTimerPanel');
      const button = $('#toggleTimerBtn');
      panel?.classList.toggle('is-hidden', practiceState.timerHidden);
      if (button) {
        button.textContent = practiceState.timerHidden ? 'Show' : 'Hide';
        button.setAttribute('aria-pressed', String(practiceState.timerHidden));
      }
    });
  };

  const initResult = async () => {
    const user = requireAuth(['student']);
    if (!user) return;
    const practiceId = new URLSearchParams(window.location.search).get('id');
    if (!practiceId) return;

    try {
      const { practice } = await api(`/student/practice/${practiceId}`);
      const percent = practice.totalMarks ? Math.round((practice.score / practice.totalMarks) * 100) : 0;
      statCard('#resultScore', `${practice.score}/${practice.totalMarks}`);
      statCard('#resultPercent', `${percent}%`);
      statCard('#resultTime', `${Math.floor((practice.timeTaken || 0) / 60)} min`);
      const questionCount = practice.questions.length;
      const questionCountLabel = $('#resultQuestionCount');
      const flaggedQuestions = new Set(
        JSON.parse(localStorage.getItem(`practiceFlags:${practiceId}`) || '[]')
      );
      if (questionCountLabel) {
        questionCountLabel.textContent = `${questionCount} ${questionCount === 1 ? 'question' : 'questions'}`;
      }

      $('#reviewList').innerHTML = practice.questions
        .map((question, index) => {
          const answer = practice.answers.find((item) => item.questionId === String(question._id)) || {};
          const selectedAnswer = String(answer.answer || '').trim();
          const correctAnswer = String(question.correctAnswer || '').trim();
          const isAnswered = Boolean(selectedAnswer);
          const isCorrect = Boolean(answer.isCorrect);
          const questionMarks = Number(question.marks || 0);
          const marksAwarded = Number(answer.marksAwarded || 0);
          const isFlagged = flaggedQuestions.has(String(question._id));
          const options = Array.isArray(question.options) && question.options.length
            ? question.options
            : [selectedAnswer, correctAnswer].filter(Boolean);
          const uniqueOptions = [...new Set(options)];
          const optionList = uniqueOptions
            .map((option, optionIndex) => {
              const optionText = String(option || '').trim();
              const isSelected = selectedAnswer && optionText === selectedAnswer;
              const isCorrectOption = correctAnswer && optionText === correctAnswer;
              const showCorrectTick = !isCorrect && isCorrectOption;
              const optionClass = [
                'practice-review-option',
                isSelected ? 'is-selected' : '',
                isCorrect && isSelected ? 'is-selected-correct' : '',
                !isCorrect && isSelected ? 'is-selected-wrong' : '',
                showCorrectTick ? 'is-correct-answer' : ''
              ]
                .filter(Boolean)
                .join(' ');
              return `
                <li class="${optionClass}">
                  <span class="practice-review-radio" aria-hidden="true"><span></span></span>
                  <span class="practice-review-option-letter">${String.fromCharCode(65 + optionIndex)}.</span>
                  <span class="practice-review-option-text">${escapeHtml(optionText || '-')}</span>
                  ${showCorrectTick ? '<i class="bi bi-check-lg practice-review-correct-tick" aria-label="Correct answer"></i>' : ''}
                </li>
              `;
            })
            .join('');
          const resultStatus = !isAnswered ? 'Not answered' : isCorrect ? 'Correct' : 'Incorrect';
          const resultTone = !isAnswered ? 'unanswered' : isCorrect ? 'correct' : 'wrong';
          return `
            <article class="practice-review-item ${resultTone}">
              <div class="practice-review-status-card">
                <div>
                  <span>Question ${index + 1}</span>
                  <strong>${resultStatus}</strong>
                </div>
                <div>
                  <span>Marks</span>
                  <strong>${marksAwarded.toFixed(2)} out of ${questionMarks.toFixed(2)}</strong>
                </div>
                <div class="practice-review-flag ${isFlagged ? 'is-flagged' : ''}">
                  <i class="bi ${isFlagged ? 'bi-flag-fill' : 'bi-flag'}" aria-hidden="true"></i>
                  ${isFlagged ? 'Flagged question' : 'Not flagged'}
                </div>
              </div>

              <div class="practice-review-question-card">
                <h3>${escapeHtml(question.question)}</h3>
                <ul class="practice-review-options">${optionList}</ul>
              </div>

              <div class="practice-review-feedback">
                <strong>The correct answer is: ${escapeHtml(correctAnswer || 'Teacher review required')}</strong>
                ${question.explanation ? `<p>${escapeHtml(question.explanation)}</p>` : ''}
              </div>
            </article>
          `;
        })
        .join('');

      $('#retryPracticeBtn')?.addEventListener('click', () => {
        const filters = practice.filters || {};
        const params = new URLSearchParams({ subject: filters.subject || '' });
        window.location.href = `/student/practice-setup.html?${params.toString()}`;
      });

      $('#finishReviewBtn')?.addEventListener('click', () => {
        localStorage.removeItem(`practiceFlags:${practiceId}`);
        window.location.href = appUrl('/dashboard/student-dashboard.html');
      });
    } catch (error) {
      showMessage(error.message, 'danger');
    }
  };

  const initAdminDashboard = async () => {
    const user = requireAuth(['admin']);
    if (!user) return;
    initAdminChrome();
    const canViewFinance = isSuperAdminUser(user);
    setSuperAdminOnlyVisibility(canViewFinance);
    wireDashboardSearch();

    try {
      const [{ stats }, { analytics }, { logs }] = await Promise.all([
        api('/admin/stats'),
        api('/admin/analytics'),
        api('/admin/paper-logs')
      ]);
      const [{ payments }, { subscriptions }] = canViewFinance
        ? await Promise.all([api('/admin/payments'), api('/admin/subscriptions')])
        : [{ payments: [] }, { subscriptions: [] }];
      statCard('#adminTotalUsers', stats.totalUsers);
      statCard('#adminActiveUsers', stats.activeUsers);
      statCard('#adminRevenue', money(stats.revenue));
      statCard('#adminAiUsage', stats.papers);
      statCard('#adminQuestions', stats.questions);
      statCard('#adminPractices', stats.practices);
      statCard('#adminProUsers', stats.proUsers);
      const conversionRate = stats.totalUsers ? Math.round((Number(stats.proUsers || 0) / Number(stats.totalUsers || 1)) * 100) : 0;
      const succeededPayments = payments.filter((payment) => payment.status === 'succeeded').length;
      const paymentSuccess = payments.length ? Math.round((succeededPayments / payments.length) * 100) : 0;
      statCard('#adminConversionRate', `${conversionRate}%`);
      statCard('#adminPaymentSuccess', `${paymentSuccess}%`);
      statCard('#adminQuestionCoverage', stats.questions);

      if (canViewFinance) {
        renderMiniList('#adminRecentPayments', payments.slice(0, 5), (payment) => `
          <li class="admin-record">
            <div class="admin-record-main">
              <span class="status-dot ${adminStatusTone(payment.status)}"></span>
              <div>
                <strong>${escapeHtml(adminRecordName(payment.userId, 'Guest payment'))}</strong>
                <small>${escapeHtml(adminLabel(payment.provider, 'Manual'))} / ${escapeHtml(adminLabel(payment.plan, 'Plan'))}</small>
              </div>
            </div>
            <div class="admin-record-side">
              <strong>${money(payment.amount)}</strong>
              <span class="admin-status-badge ${adminStatusTone(payment.status)}">${escapeHtml(adminLabel(payment.status, 'Recorded'))}</span>
            </div>
          </li>
        `);
      }

      renderMiniList('#adminRecentLogs', logs.slice(0, 5), (log) => `
        <li class="admin-record">
          <div class="admin-record-main">
            <span class="status-dot neutral"></span>
            <div>
              <strong>${escapeHtml(log.subject || 'Paper')}</strong>
              <small>${escapeHtml(adminRecordName(log.userId, 'Teacher record'))} / ${escapeHtml(adminLabel(log.mode, 'Mode'))}</small>
            </div>
          </div>
          <div class="admin-record-side">
            <strong>${escapeHtml(adminDate(log.createdAt))}</strong>
            <span class="admin-status-badge neutral">Paper</span>
          </div>
        </li>
      `);

      if (canViewFinance) {
        renderMiniList('#adminSubscriptionWatch', subscriptions.slice(0, 5), (subscription) => `
          <li class="admin-record">
            <div class="admin-record-main">
              <span class="status-dot ${adminStatusTone(subscription.status)}"></span>
              <div>
                <strong>${escapeHtml(adminRecordName(subscription.userId, 'User record'))}</strong>
                <small>${escapeHtml(adminLabel(subscription.status, 'Status'))} / ${escapeHtml(adminLabel(subscription.plan, 'Free'))}</small>
              </div>
            </div>
            <div class="admin-record-side">
              <strong>${escapeHtml(adminDate(subscription.expiryDate, 'No expiry'))}</strong>
              <span class="admin-status-badge ${adminStatusTone(subscription.status)}">${escapeHtml(adminLabel(subscription.status, 'Active'))}</span>
            </div>
          </li>
        `);
      }

      if (window.Chart && $('#adminRevenueChart')) {
        new Chart($('#adminRevenueChart'), {
          type: 'bar',
          data: {
            labels: ['Payments', 'Papers', 'Practice', 'Questions'],
            datasets: [
              {
                label: 'Platform activity',
                data: [payments.length, stats.papers, stats.practices, Math.min(stats.questions, 500)],
                backgroundColor: ['#2563eb', '#14b8a6', '#f59e0b', '#475467']
              }
            ]
          },
          options: { plugins: { legend: { display: false } } }
        });
      }

      if (window.Chart && $('#adminRoleChart')) {
        new Chart($('#adminRoleChart'), {
          type: 'doughnut',
          data: {
            labels: analytics.userByRole.map((item) => item._id || 'unknown'),
            datasets: [{ data: analytics.userByRole.map((item) => item.count), backgroundColor: ['#2563eb', '#14b8a6', '#f59e0b'] }]
          }
        });
      }
    } catch (error) {
      showMessage(error.message, 'danger');
    }
  };

  const initAdminUsers = async () => {
    const user = requireAuth(['admin']);
    if (!user) return;
    initAdminChrome();
    const table = $('#usersBody');
    const canManageRoles = isSuperAdminUser(user);
    let allUsers = [];

    const loadUsers = async () => {
      const { users } = await api('/admin/users');
      allUsers = users;
      const query = ($('#userSearch')?.value || '').toLowerCase();
      const role = $('#userRoleFilter')?.value || '';
      const status = $('#userStatusFilter')?.value || '';
      const filtered = users.filter((item) => {
        const text = `${item.name} ${item.email}`.toLowerCase();
        return (!query || text.includes(query)) && (!role || item.role === role) && (!status || item.status === status);
      });

      statCard('#usersTotalCount', users.length);
      statCard('#usersActiveCount', users.filter((item) => item.status === 'active').length);
      statCard('#usersTeacherCount', users.filter((item) => item.role === 'teacher').length);
      statCard('#usersStudentCount', users.filter((item) => item.role === 'student').length);

      table.innerHTML = filtered
        .map(
          (item) => {
            const isOwnAccount = String(item._id) === String(user.id || user._id || '');
            const roleOptions = [
              'teacher',
              'student',
              ...(canManageRoles || item.role === 'admin' ? ['admin'] : []),
              ...(item.role === 'super_admin' ? ['super_admin'] : [])
            ];
            const disabledRoleSelect = !canManageRoles
              ? 'disabled title="Only the super admin can change roles"'
              : isOwnAccount
                ? 'disabled title="Super admin own role is locked"'
                : '';
            return `
            <tr>
              <td>${escapeHtml(item.name)}</td>
              <td>${escapeHtml(item.email)}</td>
              <td>
                <select class="form-select form-select-sm js-role" data-id="${item._id}" data-current-role="${escapeHtml(item.role)}" ${disabledRoleSelect}>
                  ${roleOptions
                    .map((role) => `<option value="${role}" ${item.role === role ? 'selected' : ''}>${role}</option>`)
                    .join('')}
                </select>
              </td>
              <td><span class="badge text-bg-${item.status === 'active' ? 'success' : 'secondary'}">${item.status}</span></td>
              <td>
                <button class="btn btn-sm btn-outline-primary js-status" data-id="${item._id}" data-status="${item.status === 'active' ? 'inactive' : 'active'}">
                  ${item.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button class="btn btn-sm btn-outline-danger js-delete-user" data-id="${item._id}">Delete</button>
              </td>
            </tr>
          `;
          }
        )
        .join('');
    };

    try {
      await loadUsers();
    } catch (error) {
      showMessage(error.message, 'danger');
    }

    table?.addEventListener('change', async (event) => {
      if (!event.target.matches('.js-role')) return;
      try {
        await api(`/admin/users/${event.target.dataset.id}`, {
          method: 'PATCH',
          body: { role: event.target.value }
        });
        event.target.dataset.currentRole = event.target.value;
        await loadUsers();
        showMessage('Role updated', 'success');
      } catch (error) {
        event.target.value = event.target.dataset.currentRole || event.target.value;
        await loadUsers();
        showMessage(error.message, 'danger');
      }
    });

    table?.addEventListener('click', async (event) => {
      if (event.target.matches('.js-delete-user')) {
        if (!confirm('Delete this user?')) return;
        try {
          await api(`/admin/users/${event.target.dataset.id}`, { method: 'DELETE' });
          await loadUsers();
          showMessage('User deleted', 'success');
        } catch (error) {
          showMessage(error.message, 'danger');
        }
        return;
      }

      if (!event.target.matches('.js-status')) return;
      try {
        await api(`/admin/users/${event.target.dataset.id}`, {
          method: 'PATCH',
          body: { status: event.target.dataset.status }
        });
        await loadUsers();
        showMessage('User status updated', 'success');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });

    $('#userSearch')?.addEventListener('input', loadUsers);
    $('#userRoleFilter')?.addEventListener('change', loadUsers);
    $('#userStatusFilter')?.addEventListener('change', loadUsers);
    $('#exportUsersBtn')?.addEventListener('click', () => {
      const rows = allUsers.map((item) => [item.name, item.email, item.role, item.status].map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','));
      downloadTextFile('paper-forge-users.csv', ['Name,Email,Role,Status', ...rows].join('\n'));
    });
  };

  const initAnalytics = async () => {
    const user = requireAuth(['admin']);
    if (!user) return;
    initAdminChrome();

    try {
      const { analytics } = await api('/admin/analytics');
      const paperLabels = analytics.paperBySubject.map((item) => item._id || 'Unknown');
      const paperCounts = analytics.paperBySubject.map((item) => item.count);
      const roleLabels = analytics.userByRole.map((item) => item._id);
      const roleCounts = analytics.userByRole.map((item) => item.count);

      if (window.Chart && $('#paperChart')) {
        new Chart($('#paperChart'), {
          type: 'bar',
          data: {
            labels: paperLabels,
            datasets: [{ label: 'Generated papers', data: paperCounts, backgroundColor: '#2563eb' }]
          }
        });
      }

      if (window.Chart && $('#roleChart')) {
        new Chart($('#roleChart'), {
          type: 'doughnut',
          data: {
            labels: roleLabels,
            datasets: [{ label: 'Users', data: roleCounts, backgroundColor: ['#14b8a6', '#f59e0b', '#111827'] }]
          }
        });
      }
    } catch (error) {
      showMessage(error.message, 'danger');
    }
  };

  const initSubscriptions = async () => {
    const user = requireSuperAdminPage();
    if (!user) return;
    initAdminChrome();
    const table = $('#subscriptionsBody');
    let allSubscriptions = [];

    const loadSubscriptions = async () => {
      const { subscriptions } = await api('/admin/subscriptions');
      allSubscriptions = subscriptions;
      const query = ($('#subscriptionSearch')?.value || '').toLowerCase();
      const filtered = subscriptions.filter((subscription) => {
        const text = `${subscription.userId?.name || ''} ${subscription.userId?.email || ''} ${subscription.plan} ${subscription.status}`.toLowerCase();
        return !query || text.includes(query);
      });

      statCard('#subscriptionTotalCount', subscriptions.length);
      statCard('#subscriptionActiveCount', subscriptions.filter((item) => item.status === 'active').length);
      statCard('#subscriptionExpiredCount', subscriptions.filter((item) => item.status === 'expired').length);

      table.innerHTML = filtered
        .map(
          (subscription) => `
          <tr>
            <td>${escapeHtml(subscription.userId?.name || 'Unknown')}</td>
            <td>${escapeHtml(subscription.userId?.email || '')}</td>
            <td>
              <select class="form-select form-select-sm js-plan" data-id="${subscription._id}">
                <option value="free" ${subscription.plan === 'free' ? 'selected' : ''}>free</option>
                <option value="pro" ${subscription.plan === 'pro' ? 'selected' : ''}>pro</option>
              </select>
            </td>
            <td>${subscription.expiryDate ? new Date(subscription.expiryDate).toLocaleDateString() : 'No expiry'}</td>
            <td><span class="badge text-bg-light subscription-status-badge">${escapeHtml(statusLabel(subscription.status, 'Status'))}</span></td>
            <td><button class="btn btn-sm btn-outline-success js-manual-sub" data-user="${subscription.userId?._id}">Manual Active</button></td>
          </tr>
        `
        )
        .join('');
    };

    try {
      await loadSubscriptions();
    } catch (error) {
      showMessage(error.message, 'danger');
    }

    table?.addEventListener('change', async (event) => {
      if (!event.target.matches('.js-plan')) return;
      try {
        await api(`/admin/subscriptions/${event.target.dataset.id}`, {
          method: 'PATCH',
          body: { plan: event.target.value }
        });
        await loadSubscriptions();
        showMessage('Subscription updated', 'success');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });

    table?.addEventListener('click', async (event) => {
      if (!event.target.matches('.js-manual-sub')) return;
      const endDate = prompt('Subscription end date (YYYY-MM-DD)', new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
      if (!endDate) return;
      try {
        await api(`/admin/users/${event.target.dataset.user}/subscription`, {
          method: 'PUT',
          body: { plan: 'manual', endDate, notes: 'Cash/Jazzcash manual payment' }
        });
        await loadSubscriptions();
        showMessage('Manual subscription activated', 'success');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });

    $('#subscriptionSearch')?.addEventListener('input', loadSubscriptions);
    $('#expireSubscriptionsBtn')?.addEventListener('click', async () => {
      try {
        const { expired } = await api('/admin/subscriptions/expire-now', { method: 'POST' });
        await loadSubscriptions();
        showMessage(`${expired} subscriptions expired`, 'success');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });
    $('#exportSubscriptionsBtn')?.addEventListener('click', () => {
      const rows = allSubscriptions.map((item) =>
        [item.userId?.name, item.userId?.email, item.plan, item.status, item.expiryDate || '']
          .map((value) => `"${String(value || '').replace(/"/g, '""')}"`)
          .join(',')
      );
      downloadTextFile('paper-forge-subscriptions.csv', ['Name,Email,Plan,Status,Expiry', ...rows].join('\n'));
    });
  };

  const initSubscriptionPage = async () => {
    const user = requireAuth(['teacher', 'student', 'admin']);
    if (!user) return;
    let subscriptionData = null;
    let stripe = null;
    let stripeCardNumber = null;
    let stripeCardExpiry = null;
    let stripeCardCvc = null;
    let stripeReady = false;
    const paymentForm = $('#paymentMethodForm');
    const selectedPlan = { value: paymentForm?.elements.plan?.value || 'monthly' };

    const paymentPlanTotal = () => {
      const amount = selectedPlan.value === 'yearly' ? subscriptionData?.plans?.yearly : subscriptionData?.plans?.monthly;
      return `${money(amount)} / ${selectedPlan.value === 'yearly' ? 'Yearly' : 'Monthly'}`;
    };

    const syncPaymentPlan = () => {
      $$('.plan-option').forEach((button) => button.classList.toggle('active', button.dataset.plan === selectedPlan.value));
      if (paymentForm?.elements.plan) paymentForm.elements.plan.value = selectedPlan.value;
      statCard('#checkoutPlanTotal', paymentPlanTotal());
      const agreement = $('#paymentAgreementText');
      if (agreement) {
        agreement.textContent = `You agree that Paper Forge will charge your card ${paymentPlanTotal()} for the selected plan. You can cancel in your account settings.`;
      }
    };

    const formatCardNumber = (value) =>
      value
        .replace(/\D/g, '')
        .slice(0, 16)
        .replace(/(.{4})/g, '$1 ')
        .trim();

    const formatExpiry = (value) => {
      const digits = value.replace(/\D/g, '').slice(0, 4);
      return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
    };

    const getCardExpiryError = (value) => {
      const digits = String(value || '').replace(/\D/g, '');
      if (digits.length !== 4) return 'Please enter card expiry as MM / YY.';

      const month = Number(digits.slice(0, 2));
      const year = 2000 + Number(digits.slice(2));
      if (month < 1 || month > 12) return 'Card expiry month must be between 01 and 12.';

      const expiryEnd = new Date(year, month, 0, 23, 59, 59, 999);
      if (expiryEnd <= new Date()) return 'Card expiry date must be greater than the current date.';

      return '';
    };

    const setStripeMode = (enabled) => {
      $$('.demo-card-input').forEach((input) => {
        input.hidden = enabled;
        input.required = !enabled;
      });
      $$('.stripe-element-slot').forEach((slot) => {
        slot.hidden = !enabled;
      });
    };

    const mountStripeElements = () => {
      if (stripeReady) {
        setStripeMode(true);
        return;
      }
      if (!subscriptionData?.stripe?.enabled) {
        setStripeMode(false);
        return;
      }
      if (!window.Stripe || !$('#stripeCardNumber')) {
        const submitButton = $('#paymentSubmitBtn');
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Payment unavailable';
        }
        showMessage('Card payment gateway did not load. Please refresh the page.', 'danger');
        return;
      }

      stripe = window.Stripe(subscriptionData.stripe.publishableKey);
      const elements = stripe.elements();
      const elementStyle = {
        base: {
          color: '#1f2937',
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: '17px',
          fontWeight: '500',
          '::placeholder': { color: '#7d8795' }
        }
      };
      stripeCardNumber = elements.create('cardNumber', {
        style: elementStyle,
        placeholder: '1234 1234 1234 1234'
      });
      stripeCardNumber.mount('#stripeCardNumber');
      stripeCardExpiry = elements.create('cardExpiry', { style: elementStyle });
      stripeCardExpiry.mount('#stripeCardExpiry');
      stripeCardCvc = elements.create('cardCvc', { style: elementStyle });
      stripeCardCvc.mount('#stripeCardCvc');
      stripeReady = true;
      setStripeMode(true);
    };

    const loadStatus = async () => {
      const data = await api('/subscription/status');
      subscriptionData = data;
      const sub = data.subscription;
      statCard('#subStatus', statusLabel(sub.status, 'Trial Available'));
      statCard('#subPlan', sub.plan || '-');
      statCard('#subDays', sub.remainingDays || 0);
      statCard('#subTrial', sub.trialUsedAt ? 'Used' : 'Available');
      statCard('#monthlyPrice', data.plans.monthly);
      statCard('#yearlyPrice', data.plans.yearly);
      if (paymentForm?.elements.fullName && !paymentForm.elements.fullName.value) {
        paymentForm.elements.fullName.value = user.name || '';
      }
      mountStripeElements();
      syncPaymentPlan();
    };

    try {
      await loadStatus();
    } catch (error) {
      showMessage(error.message, 'danger');
    }

    $$('.plan-option').forEach((button) => {
      button.addEventListener('click', () => {
        selectedPlan.value = button.dataset.plan || 'monthly';
        syncPaymentPlan();
      });
    });

    paymentForm?.elements.cardNumber?.addEventListener('input', (event) => {
      event.target.value = formatCardNumber(event.target.value);
    });

    paymentForm?.elements.expiry?.addEventListener('input', (event) => {
      event.target.value = formatExpiry(event.target.value);
    });

    paymentForm?.elements.cvc?.addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 4);
    });

    paymentForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = $('#paymentSubmitBtn');
      if (!stripeReady) {
        const cardDigits = paymentForm.elements.cardNumber.value.replace(/\D/g, '');
        const expiryDigits = paymentForm.elements.expiry.value.replace(/\D/g, '');
        const cvcDigits = paymentForm.elements.cvc.value.replace(/\D/g, '');
        if (cardDigits.length < 12 || expiryDigits.length !== 4 || cvcDigits.length < 3) {
          showMessage('Please enter valid card details.', 'danger');
          return;
        }
        const expiryError = getCardExpiryError(paymentForm.elements.expiry.value);
        if (expiryError) {
          paymentForm.elements.expiry.focus();
          showMessage(expiryError, 'danger');
          return;
        }
      }
      if (!paymentForm.elements.agreement.checked) {
        showMessage('Please accept the payment agreement.', 'danger');
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';
      }

      try {
        const order = await api('/subscription/create-order', {
          method: 'POST',
          body: {
            plan: selectedPlan.value,
            provider: stripeReady ? 'stripe' : 'demo',
            cardExpiry: stripeReady ? undefined : paymentForm.elements.expiry.value
          }
        });

        if (stripeReady) {
          const result = await stripe.confirmCardPayment(order.clientSecret, {
            payment_method: {
              card: stripeCardNumber,
              billing_details: {
                name: formValue(paymentForm, 'fullName'),
                address: {
                  country: formValue(paymentForm, 'country'),
                  line1: formValue(paymentForm, 'address')
                }
              }
            }
          });
          if (result.error) throw new Error(result.error.message);
          await api('/subscription/confirm-stripe', {
            method: 'POST',
            body: { paymentIntentId: result.paymentIntent.id }
          });
        }

        showMessage(stripeReady ? 'Payment successful. Subscription activated.' : 'Subscription activated successfully', 'success');
        paymentForm.reset();
        stripeCardNumber?.clear();
        stripeCardExpiry?.clear();
        stripeCardCvc?.clear();
        selectedPlan.value = 'monthly';
        await loadStatus();
      } catch (error) {
        showMessage(error.message, 'danger');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Subscribe';
        }
      }
    });

    $$('.js-subscribe').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          const order = await api('/subscription/create-order', {
            method: 'POST',
            body: {
              plan: button.dataset.plan,
              provider: button.dataset.provider || 'demo'
            }
          });
          showMessage(order.message || 'Subscription order created', 'success');
          await loadStatus();
        } catch (error) {
          showMessage(error.message, 'danger');
        }
      });
    });
  };

  const initResources = async () => {
    const user = requireAuth(['teacher', 'student', 'admin']);
    if (!user) return;
    if (isAdminUser(user)) initAdminChrome();
    const uploadPanel = $('#resourceUploadPanel');
    if (uploadPanel && user.role === 'student') uploadPanel.style.display = 'none';

    const loadResources = async () => {
      const { resources } = await api('/resources');
      $('#resourcesBody').innerHTML = resources
        .map(
          (resource) => `
          <tr>
            <td>${escapeHtml(resource.title)}</td>
            <td>${escapeHtml(resource.type)}</td>
            <td>${escapeHtml(resource.classLevel || '-')}</td>
            <td>${escapeHtml(resource.subject || '-')}</td>
            <td><a class="btn btn-sm btn-outline-primary" href="${escapeHtml(resource.fileUrl)}" target="_blank">Download</a></td>
          </tr>
        `
        )
        .join('');
    };

    try {
      await loadResources();
    } catch (error) {
      showMessage(error.message, 'danger');
    }

    $('#resourceUploadForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const body = new FormData(form);
      try {
        await api('/resources', { method: 'POST', body });
        form.reset();
        await loadResources();
        showMessage('PDF uploaded', 'success');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });
  };

  const initAdminQuestions = async () => {
    const user = requireAuth(['admin']);
    if (!user) return;
    initAdminChrome();
    const form = $('#adminQuestionForm');
    const filterForm = $('#questionFilterForm');
    const body = $('#adminQuestionsBody');
    let editingQuestionId = null;
    let currentQuestions = [];
    const defaultQuestionMarks = { mcq: 1, short: 3, long: 5 };

    const refreshAdminQuestionChapters = (selected = '') => {
      if (!form) return;
      populateChapterDropdown(form.elements.chapter, {
        classLevel: formValue(form, 'classLevel') || '9th',
        subject: formValue(form, 'subject') || 'Physics',
        selected
      });
    };

    const refreshFilterChapters = (selected = '') => {
      if (!filterForm) return;
      populateChapterDropdown(filterForm.elements.chapter, {
        classLevel: formValue(filterForm, 'classLevel'),
        subject: formValue(filterForm, 'subject'),
        includeAll: true,
        selected
      });
    };

    const syncAdminQuestionType = (setDefaultMarks = false) => {
      if (!form) return;
      const type = formValue(form, 'type') || 'mcq';
      $$('.admin-mcq-field', form).forEach((field) => {
        field.hidden = type !== 'mcq';
      });
      if (setDefaultMarks && form.elements.marks) {
        form.elements.marks.value = defaultQuestionMarks[type] || 1;
      }
    };

    const load = async () => {
      const params = new URLSearchParams();
      ['classLevel', 'subject', 'chapter', 'type'].forEach((field) => {
        const value = formValue(filterForm, field);
        if (value) params.set(field, value);
      });
      params.set('limit', '5000');
      const endpoint = params.toString() ? `/questions?${params.toString()}` : '/questions';
      const { questions } = await api(endpoint);
      currentQuestions = questions;
      statCard('#questionTotalCount', questions.length);
      statCard('#questionMcqCount', questions.filter((question) => question.type === 'mcq').length);
      statCard('#questionShortCount', questions.filter((question) => question.type === 'short').length);
      statCard('#questionLongCount', questions.filter((question) => question.type === 'long').length);

      if (body) {
        body.innerHTML = questions
          .map(
            (question) => `
            <tr>
              <td>${escapeHtml(question.classLevel)}</td>
              <td>${escapeHtml(question.subject)}</td>
              <td>${escapeHtml(question.chapter)}</td>
              <td><span class="pill-soft">${escapeHtml(question.type)}</span></td>
              <td>${escapeHtml(question.question).slice(0, 110)}</td>
              <td class="table-actions">
                <button class="btn btn-sm btn-outline-primary js-edit-admin-question" data-id="${question._id}">Edit</button>
                <button class="btn btn-sm btn-outline-danger js-delete-admin-question" data-id="${question._id}">Delete</button>
              </td>
            </tr>
          `
          )
          .join('');
      }

      const list = $('#adminQuestionList');
      if (list) {
        list.innerHTML = questions
          .slice(0, 8)
          .map(
            (question) => `
            <div class="question-mini">
              <strong>${escapeHtml(question.classLevel)} / ${escapeHtml(question.subject)} / ${escapeHtml(question.chapter)} / ${escapeHtml(question.type)}</strong>
              <span>${escapeHtml(question.question)}</span>
            </div>
          `
          )
          .join('');
      }
    };

    const resetForm = () => {
      editingQuestionId = null;
      form?.reset();
      refreshAdminQuestionChapters();
      syncAdminQuestionType(true);
      if ($('#questionFormTitle')) $('#questionFormTitle').textContent = 'Create question';
      if ($('#saveQuestionBtn')) $('#saveQuestionBtn').innerHTML = '<i class="bi bi-plus-circle"></i> Save Question';
    };

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const type = formValue(form, 'type');
      const payload = {
        classLevel: formValue(form, 'classLevel'),
        classId: formValue(form, 'classLevel'),
        subject: formValue(form, 'subject'),
        subjectId: formValue(form, 'subject'),
        chapter: formValue(form, 'chapter'),
        chapterId: formValue(form, 'chapter'),
        type,
        question: formValue(form, 'question'),
        options:
          type === 'mcq'
            ? formValue(form, 'options')
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean)
            : [],
        correctAnswer: type === 'mcq' ? formValue(form, 'correctAnswer') : '',
        difficulty: formValue(form, 'difficulty') || 'medium',
        marks: Number(formValue(form, 'marks') || 1),
        explanation: formValue(form, 'explanation'),
        isImportant: form.elements.isImportant?.checked || false
      };

      try {
        await api(editingQuestionId ? `/questions/${editingQuestionId}` : '/questions', {
          method: editingQuestionId ? 'PUT' : 'POST',
          body: payload
        });
        resetForm();
        await load();
        showMessage('Question saved', 'success');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });

    body?.addEventListener('click', async (event) => {
      const editButton = event.target.closest('.js-edit-admin-question');
      const deleteButton = event.target.closest('.js-delete-admin-question');
      if (editButton) {
        const question = currentQuestions.find((item) => item._id === editButton.dataset.id);
        if (!question || !form) return;
        editingQuestionId = question._id;
        form.elements.classLevel.value = question.classLevel || '9th';
        form.elements.subject.value = question.subject || 'Physics';
        refreshAdminQuestionChapters(question.chapter || '');
        form.elements.chapter.value = question.chapter || '';
        form.elements.type.value = question.type || 'mcq';
        form.elements.question.value = question.question || '';
        form.elements.options.value = (question.options || []).join('\n');
        form.elements.correctAnswer.value = question.correctAnswer || '';
        form.elements.difficulty.value = question.difficulty || 'medium';
        form.elements.marks.value = question.marks || 1;
        form.elements.explanation.value = question.explanation || '';
        form.elements.isImportant.checked = Boolean(question.isImportant);
        syncAdminQuestionType(false);
        if ($('#questionFormTitle')) $('#questionFormTitle').textContent = 'Edit question';
        if ($('#saveQuestionBtn')) $('#saveQuestionBtn').innerHTML = '<i class="bi bi-save"></i> Update Question';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (deleteButton) {
        if (!confirm('Delete this question?')) return;
        try {
          await api(`/questions/${deleteButton.dataset.id}`, { method: 'DELETE' });
          await load();
          showMessage('Question deleted', 'success');
        } catch (error) {
          showMessage(error.message, 'danger');
        }
      }
    });

    form?.elements.classLevel?.addEventListener('change', () => refreshAdminQuestionChapters());
    form?.elements.subject?.addEventListener('change', () => refreshAdminQuestionChapters());
    form?.elements.type?.addEventListener('change', () => syncAdminQuestionType(true));

    $('#cancelQuestionEdit')?.addEventListener('click', resetForm);
    filterForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await load();
    });
    filterForm?.elements.classLevel?.addEventListener('change', async () => {
      refreshFilterChapters();
      await load();
    });
    filterForm?.elements.subject?.addEventListener('change', async () => {
      refreshFilterChapters();
      await load();
    });
    filterForm?.elements.chapter?.addEventListener('change', load);
    filterForm?.elements.type?.addEventListener('change', load);

    $('#exportQuestionsBtn')?.addEventListener('click', () => {
      downloadTextFile('paper-forge-questions.json', JSON.stringify(currentQuestions, null, 2));
    });

    $('#questionJsonForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const questions = JSON.parse(formValue(event.currentTarget, 'json'));
        await api('/admin/questions/bulk-json', { method: 'POST', body: questions });
        showMessage('Questions imported', 'success');
        await load();
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });

    try {
      refreshAdminQuestionChapters();
      refreshFilterChapters();
      syncAdminQuestionType(false);
      await load();
    } catch (error) {
      showMessage(error.message, 'danger');
    }
  };

  const initAdminCatalog = async () => {
    const user = requireAuth(['admin']);
    if (!user) return;
    initAdminChrome();
    const form = $('#catalogForm');
    const body = $('#catalogBody');

    const loadCatalog = async () => {
      const { items } = await api('/admin/catalog');
      statCard('#catalogClassCount', items.filter((item) => item.kind === 'class').length);
      statCard('#catalogSubjectCount', items.filter((item) => item.kind === 'subject').length);
      statCard('#catalogChapterCount', items.filter((item) => item.kind === 'chapter').length);
      if (!body) return;
      body.innerHTML = items
        .map(
          (item) => `
          <tr>
            <td><span class="pill-soft">${escapeHtml(item.kind)}</span></td>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.classLevel || '-')}</td>
            <td>${escapeHtml(item.subject || '-')}</td>
            <td>${new Date(item.createdAt).toLocaleDateString()}</td>
            <td><button class="btn btn-sm btn-outline-danger js-delete-catalog" data-id="${item._id}">Delete</button></td>
          </tr>
        `
        )
        .join('');
    };

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const kind = formValue(form, 'kind');
      try {
        await api(`/admin/${kind}`, {
          method: 'POST',
          body: {
            name: formValue(form, 'name'),
            classLevel: formValue(form, 'classLevel'),
            subject: formValue(form, 'subject')
          }
        });
        form.reset();
        await loadCatalog();
        showMessage('Catalog item saved', 'success');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });

    body?.addEventListener('click', async (event) => {
      if (!event.target.matches('.js-delete-catalog')) return;
      if (!confirm('Delete this catalog item?')) return;
      try {
        await api(`/admin/catalog/${event.target.dataset.id}`, { method: 'DELETE' });
        await loadCatalog();
        showMessage('Catalog item deleted', 'success');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });

    try {
      await loadCatalog();
    } catch (error) {
      showMessage(error.message, 'danger');
    }
  };

  const initAdminPayments = async () => {
    const user = requireSuperAdminPage();
    if (!user) return;
    initAdminChrome();
    let paymentsData = [];
    try {
      const { payments } = await api('/admin/payments');
      paymentsData = payments;
      statCard('#paymentsTotalCount', payments.length);
      statCard('#paymentsRevenueCount', money(payments.filter((payment) => payment.status === 'succeeded').reduce((sum, payment) => sum + Number(payment.amount || 0), 0)));
      statCard('#paymentsPendingCount', payments.filter((payment) => payment.status === 'pending').length);
      $('#paymentsBody').innerHTML = payments
        .map(
          (payment) => `
          <tr>
            <td>${escapeHtml(payment.userId?.name || '-')}</td>
            <td>${escapeHtml(payment.plan)}</td>
            <td>${escapeHtml(payment.provider)}</td>
            <td>PKR ${payment.amount}</td>
            <td><span class="badge text-bg-light">${escapeHtml(payment.status)}</span></td>
            <td>${new Date(payment.createdAt).toLocaleString()}</td>
          </tr>
        `
        )
        .join('');
    } catch (error) {
      showMessage(error.message, 'danger');
    }

    $('#exportPaymentsBtn')?.addEventListener('click', () => {
      const rows = paymentsData.map((item) =>
        [item.userId?.name, item.userId?.email, item.plan, item.provider, item.amount, item.status, item.createdAt]
          .map((value) => `"${String(value || '').replace(/"/g, '""')}"`)
          .join(',')
      );
      downloadTextFile('paper-forge-payments.csv', ['Name,Email,Plan,Provider,Amount,Status,Date', ...rows].join('\n'));
    });
  };

  const initAdminPaperLogs = async () => {
    const user = requireAuth(['admin']);
    if (!user) return;
    initAdminChrome();
    let logsData = [];
    try {
      const { logs } = await api('/admin/paper-logs');
      logsData = logs;
      statCard('#paperLogsTotalCount', logs.length);
      statCard('#paperLogsFullCount', logs.filter((log) => log.mode === 'full').length);
      statCard('#paperLogsCustomCount', logs.filter((log) => log.mode === 'custom').length);
      $('#paperLogsBody').innerHTML = logs
        .map(
          (log) => `
          <tr>
            <td>${escapeHtml(log.userId?.name || '-')}</td>
            <td>${escapeHtml(log.userId?.role || '-')}</td>
            <td>${escapeHtml(log.subject || '-')}</td>
            <td>${escapeHtml((log.chapters || []).join(', ') || '-')}</td>
            <td><span class="pill-soft">${escapeHtml(log.mode || '-')}</span></td>
            <td>${log.typeCounts?.mcq || 0}/${log.typeCounts?.short || 0}/${log.typeCounts?.long || 0}</td>
            <td>${new Date(log.createdAt).toLocaleString()}</td>
          </tr>
        `
        )
        .join('');
    } catch (error) {
      showMessage(error.message, 'danger');
    }

    $('#exportPaperLogsBtn')?.addEventListener('click', () => {
      downloadTextFile('paper-forge-paper-logs.json', JSON.stringify(logsData, null, 2));
    });
  };

  const initAdminChatbotLogs = async () => {
    const user = requireAuth(['admin']);
    if (!user) return;
    initAdminChrome();
    let logsData = [];
    try {
      const { logs } = await api('/admin/chatbot-logs');
      logsData = logs;
      statCard('#chatbotLogsTotalCount', logs.length);
      statCard('#chatbotLogsConfirmCount', logs.filter((log) => log.status === 'awaiting_confirmation').length);
      statCard('#chatbotLogsGeneratedCount', logs.filter((log) => log.status === 'generated').length);
      statCard('#chatbotLogsErrorCount', logs.filter((log) => log.status === 'error').length);
      $('#chatbotLogsBody').innerHTML = logs.length
        ? logs
            .map(
              (log) => `
          <tr>
            <td>${escapeHtml(log.userId?.name || log.userId?.email || '-')}</td>
            <td>${escapeHtml(log.userId?.role || log.role || '-')}</td>
            <td><span class="pill-soft">${escapeHtml(adminLabel(log.intent || 'unknown'))}</span></td>
            <td>${escapeHtml(adminLabel(log.action || log.status || '-'))}</td>
            <td>${escapeHtml(log.message || '-')}</td>
            <td>${escapeHtml(log.error || log.responseMessage || '-')}</td>
            <td>${new Date(log.createdAt).toLocaleString()}</td>
          </tr>
        `
            )
            .join('')
        : '<tr><td colspan="7" class="text-center text-muted py-4">No chatbot logs yet.</td></tr>';
    } catch (error) {
      showMessage(error.message, 'danger');
    }

    $('#exportChatbotLogsBtn')?.addEventListener('click', () => {
      downloadTextFile('paper-forge-chatbot-logs.json', JSON.stringify(logsData, null, 2));
    });
  };

  const initAdminReports = async () => {
    const user = requireSuperAdminPage();
    if (!user) return;
    initAdminChrome();
    try {
      const [{ stats }, { analytics }, { payments }, { logs }] = await Promise.all([
        api('/admin/stats'),
        api('/admin/analytics'),
        api('/admin/payments'),
        api('/admin/paper-logs')
      ]);

      statCard('#reportRevenue', money(stats.revenue));
      statCard('#reportPapers', stats.papers);
      statCard('#reportPractice', stats.practices);
      statCard('#reportQuestions', stats.questions);

      const report = {
        generatedAt: new Date().toISOString(),
        stats,
        analytics,
        recentPayments: payments.slice(0, 50),
        recentPaperLogs: logs.slice(0, 50)
      };

      if ($('#reportJsonPreview')) $('#reportJsonPreview').textContent = JSON.stringify(report, null, 2);
      $('#downloadReportJson')?.addEventListener('click', () => {
        downloadTextFile('paper-forge-admin-report.json', JSON.stringify(report, null, 2));
      });
      $('#downloadReportPdf')?.addEventListener('click', async () => {
        try {
          await downloadFile('/admin/reports/pdf', 'paper-forge-admin-report.pdf');
        } catch (error) {
          showMessage(error.message, 'danger');
        }
      });

      if (window.Chart && $('#reportSubjectChart')) {
        new Chart($('#reportSubjectChart'), {
          type: 'bar',
          data: {
            labels: analytics.paperBySubject.map((item) => item._id || 'Unknown'),
            datasets: [{ label: 'Generated papers', data: analytics.paperBySubject.map((item) => item.count), backgroundColor: '#2563eb' }]
          },
          options: { plugins: { legend: { display: false } } }
        });
      }

      if (window.Chart && $('#reportPracticeChart')) {
        new Chart($('#reportPracticeChart'), {
          type: 'line',
          data: {
            labels: analytics.practiceBySubject.map((item) => item._id || 'Unknown'),
            datasets: [{ label: 'Practice sessions', data: analytics.practiceBySubject.map((item) => item.count), borderColor: '#14b8a6', backgroundColor: 'rgba(20,184,166,.18)', fill: true, tension: 0.35 }]
          }
        });
      }
    } catch (error) {
      showMessage(error.message, 'danger');
    }
  };

  const initAdminSettings = async () => {
    const user = requireSuperAdminPage();
    if (!user) return;
    initAdminChrome();
    const form = $('#settingsForm');

    try {
      const { settings } = await api('/admin/settings');
      const fullPaper = settings.paperLimits.fullPaper || settings.paperLimits.fullPerChapter || {};
      form.elements.mcq.value = fullPaper.mcq || 100;
      form.elements.short.value = fullPaper.short || 50;
      form.elements.long.value = fullPaper.long || 20;
      form.elements.practiceMcqLimit.value = settings.paperLimits.practiceMcqLimit;
      form.elements.monthly.value = settings.pricing.monthly;
      form.elements.yearly.value = settings.pricing.yearly;
      form.elements.jazzcashNumber.value = settings.jazzcash.number;
      form.elements.jazzcashName.value = settings.jazzcash.accountName;
    } catch (error) {
      showMessage(error.message, 'danger');
    }

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await api('/admin/settings', {
          method: 'PUT',
          body: {
            paperLimits: {
              fullPaper: {
                mcq: Number(formValue(form, 'mcq')),
                short: Number(formValue(form, 'short')),
                long: Number(formValue(form, 'long'))
              },
              fullPerChapter: {
                mcq: Number(formValue(form, 'mcq')),
                short: Number(formValue(form, 'short')),
                long: Number(formValue(form, 'long'))
              },
              practiceMcqLimit: Number(formValue(form, 'practiceMcqLimit')),
              durationPerMcqSeconds: 60
            },
            pricing: {
              monthly: Number(formValue(form, 'monthly')),
              yearly: Number(formValue(form, 'yearly'))
            },
            jazzcash: {
              number: formValue(form, 'jazzcashNumber'),
              accountName: formValue(form, 'jazzcashName')
            }
          }
        });
        showMessage('Settings saved', 'success');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });
  };

  const initForgotPassword = () => {
    $('#forgotPasswordForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const email = getEmailValue(event.currentTarget);
        const data = await api('/auth/forgot-password', {
          method: 'POST',
          body: { email }
        });
        localStorage.setItem('resetEmail', email);
        if (data.devPin) localStorage.setItem('resetDevPin', data.devPin);
        window.location.href = appUrl('/check-email.html');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });
  };

  const initVerifyPin = () => {
    const devPin = localStorage.getItem('resetDevPin');
    if (devPin && $('#pinHelp')) $('#pinHelp').textContent = `Development PIN: ${devPin}`;
    $('#verifyPinForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const email = getEmailValue(event.currentTarget, {
          fallback: localStorage.getItem('resetEmail') || ''
        });
        const data = await api('/auth/verify-pin', {
          method: 'POST',
          body: {
            email,
            pin: formValue(event.currentTarget, 'pin')
          }
        });
        localStorage.setItem('resetTempToken', data.tempToken);
        window.location.href = appUrl('/set-new-password.html');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });
  };

  const initResetPassword = () => {
    $('#resetPasswordForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (formValue(form, 'password') !== formValue(form, 'confirmPassword')) {
        showMessage('Passwords do not match', 'danger');
        return;
      }
      try {
        await api('/auth/reset-password', {
          method: 'POST',
          body: {
            tempToken: localStorage.getItem('resetTempToken'),
            password: formValue(form, 'password')
          }
        });
        localStorage.removeItem('resetEmail');
        localStorage.removeItem('resetDevPin');
        localStorage.removeItem('resetTempToken');
        window.location.href = appUrl('/login.html');
      } catch (error) {
        showMessage(error.message, 'danger');
      }
    });
  };

  const pageInitializers = {
    login: initLogin,
    register: initRegister,
    'teacher-dashboard': initTeacherDashboard,
    'generate-paper': initGeneratePaper,
    'preview-paper': initPreviewPaper,
    'paper-history': initPaperHistory,
    chatbot: initChatbot,
    'student-dashboard': initStudentDashboard,
    'practice-setup': initPracticeSetup,
    'practice-test': initPracticeTest,
    result: initResult,
    'admin-dashboard': initAdminDashboard,
    users: initAdminUsers,
    analytics: initAnalytics,
    subscriptions: initSubscriptions,
    subscription: initSubscriptionPage,
    resources: initResources,
    'admin-questions': initAdminQuestions,
    'admin-catalog': initAdminCatalog,
    'admin-paper-logs': initAdminPaperLogs,
    'admin-chatbot-logs': initAdminChatbotLogs,
    'admin-payments': initAdminPayments,
    'admin-reports': initAdminReports,
    'admin-settings': initAdminSettings,
    'forgot-password': initForgotPassword,
    'check-email': initVerifyPin,
    'set-new-password': initResetPassword
  };

  document.addEventListener('DOMContentLoaded', () => {
    normalizeInternalLinks();
    wireEmailValidation();
    wirePasswordToggles();
    wireLogout();
    wireBrandHome();
    const page = document.body.dataset.page;
    if (pageInitializers[page]) {
      pageInitializers[page]();
    }

    if (page === 'home') {
      const { user } = getSession();
      if (user) $('#continueLink')?.setAttribute('href', roleHomes[user.role]);
    }
  });
})();
