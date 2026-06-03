const STORAGE_KEYS = {
    currentUser: 'expenseTracker.currentUser',
    users: 'expenseTracker.users',
    expenses: 'expenseTracker.expenses',
    initialBalance: 'expenseTracker.initialBalance',
    balanceOwnerId: 'expenseTracker.balanceOwnerId',
    memberLimit: 'expenseTracker.memberLimit'
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
});

const categoryLabels = {
    food: 'Food & Dining',
    transport: 'Transportation',
    accommodation: 'Accommodation',
    entertainment: 'Entertainment',
    shopping: 'Shopping',
    utilities: 'Utilities',
    other: 'Other'
};

let currentUser = null;
let users = [];
let expenses = [];
let initialBalance = 0;
let balanceOwnerId = null;
let memberLimit = null;

document.addEventListener('DOMContentLoaded', () => {
    loadState();
    bindEvents();
    setDefaultDate();

    if (currentUser) {
        showDashboard();
    } else {
        showLogin();
    }
});

function bindEvents() {
    document.getElementById('showLoginBtn').addEventListener('click', () => showAuthPanel('login'));
    document.getElementById('showSignupBtn').addEventListener('click', () => showAuthPanel('signup'));
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('signupForm').addEventListener('submit', handleSignup);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('expenseForm').addEventListener('submit', handleAddExpense);
    document.getElementById('setBalanceBtn').addEventListener('click', handleSetBalance);
    document.getElementById('setMemberLimitBtn').addEventListener('click', handleSetMemberLimit);
    document.getElementById('sendSummaryBtn').addEventListener('click', handlePrepareEmail);
    document.getElementById('exportBtn').addEventListener('click', handleExport);
}

function loadState() {
    users = readJson(STORAGE_KEYS.users, []);
    currentUser = readJson(STORAGE_KEYS.currentUser, null);
    expenses = readJson(STORAGE_KEYS.expenses, []);
    initialBalance = Number(localStorage.getItem(STORAGE_KEYS.initialBalance)) || 0;
    balanceOwnerId = localStorage.getItem(STORAGE_KEYS.balanceOwnerId);
    memberLimit = readNumberOrNull(STORAGE_KEYS.memberLimit);

    if (currentUser && !users.some(user => user.id === currentUser.id)) {
        currentUser = null;
        localStorage.removeItem(STORAGE_KEYS.currentUser);
    }
}

function readNumberOrNull(key) {
    const value = localStorage.getItem(key);
    const number = Number(value);
    return value === null || value === '' || !Number.isFinite(number) ? null : number;
}

function readJson(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

function saveUsers() {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

function saveExpenses() {
    localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(expenses));
}

function setDefaultDate() {
    const dateInput = document.getElementById('expenseDate');
    dateInput.valueAsDate = new Date();
}

function showAuthPanel(panel) {
    const isLogin = panel === 'login';
    document.getElementById('loginPanel').hidden = !isLogin;
    document.getElementById('signupPanel').hidden = isLogin;
    document.getElementById('showLoginBtn').classList.toggle('active', isLogin);
    document.getElementById('showSignupBtn').classList.toggle('active', !isLogin);
    clearMessage('authStatus');
}

function handleLogin(event) {
    event.preventDefault();

    const name = document.getElementById('loginName').value.trim();
    const password = document.getElementById('loginPassword').value;
    const user = users.find(account => normalizeName(account.name) === normalizeName(name));

    if (!user || user.password !== password) {
        showMessage('authStatus', 'Name or password is incorrect.', 'error');
        return;
    }

    currentUser = toSessionUser(user);
    localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(currentUser));
    event.target.reset();
    showDashboard();
}

function handleSignup(event) {
    event.preventDefault();

    const name = document.getElementById('signupName').value.trim();
    const password = document.getElementById('signupPassword').value;
    const role = document.getElementById('signupRole').value;

    if (!name || password.length < 4) {
        showMessage('authStatus', 'Enter a name and a password with at least 4 characters.', 'error');
        return;
    }

    if (users.some(user => normalizeName(user.name) === normalizeName(name))) {
        showMessage('authStatus', 'An account with this name already exists. Please login instead.', 'error');
        return;
    }

    if (role === 'member' && isMemberLimitReached()) {
        showMessage('authStatus', 'The regular member limit has already been reached.', 'error');
        return;
    }

    const user = {
        id: createId(),
        name,
        password,
        role,
        createdAt: new Date().toISOString()
    };

    users.push(user);
    saveUsers();
    currentUser = toSessionUser(user);
    localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(currentUser));
    event.target.reset();
    showDashboard();
}

function handleLogout() {
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    currentUser = null;
    showLogin();
}

function showLogin() {
    document.getElementById('loginSection').classList.add('active');
    document.getElementById('dashboardSection').classList.remove('active');
    document.getElementById('holderSection').hidden = true;
    showAuthPanel('login');
}

function showDashboard() {
    document.getElementById('loginSection').classList.remove('active');
    document.getElementById('dashboardSection').classList.add('active');
    document.getElementById('userNameDisplay').textContent = currentUser.name;
    document.getElementById('holderSection').hidden = currentUser.role !== 'holder';
    document.getElementById('initialBalanceInput').value = initialBalance || '';
    document.getElementById('balancePassword').value = '';
    document.getElementById('memberLimitInput').value = memberLimit ?? '';
    document.getElementById('memberLimitPassword').value = '';
    updateBalanceControls();
    render();
}

function handleAddExpense(event) {
    event.preventDefault();

    if (!currentUser) {
        showLogin();
        return;
    }

    const amount = Number(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value;
    const description = document.getElementById('expenseDescription').value.trim();
    const date = document.getElementById('expenseDate').value;

    if (!Number.isFinite(amount) || amount <= 0 || !category || !description || !date) {
        window.alert('Please complete all expense fields with valid values.');
        return;
    }

    expenses.unshift({
        id: createId(),
        memberName: currentUser.name,
        amount,
        category,
        description,
        date,
        createdAt: new Date().toISOString()
    });

    saveExpenses();
    event.target.reset();
    setDefaultDate();
    render();
}

function handleSetBalance() {
    const balance = Number(document.getElementById('initialBalanceInput').value);
    const password = document.getElementById('balancePassword').value;
    const savedUser = users.find(user => user.id === currentUser?.id);

    if (!Number.isFinite(balance) || balance < 0) {
        window.alert('Please enter a valid balance.');
        return;
    }

    if (currentUser?.role !== 'holder') {
        window.alert('Only the main account holder can set the balance.');
        return;
    }

    if (balanceOwnerId && balanceOwnerId !== currentUser.id) {
        window.alert('This balance is locked by the account holder who set it first.');
        return;
    }

    if (!savedUser || savedUser.password !== password) {
        window.alert('Please confirm your account password before changing the balance.');
        return;
    }

    initialBalance = balance;
    balanceOwnerId = currentUser.id;
    localStorage.setItem(STORAGE_KEYS.initialBalance, String(balance));
    localStorage.setItem(STORAGE_KEYS.balanceOwnerId, balanceOwnerId);
    document.getElementById('balancePassword').value = '';
    updateBalanceControls();
    render();
}

function handleSetMemberLimit() {
    const rawLimit = document.getElementById('memberLimitInput').value.trim();
    const password = document.getElementById('memberLimitPassword').value;
    const savedUser = users.find(user => user.id === currentUser?.id);
    const nextLimit = rawLimit === '' ? null : Number(rawLimit);
    const regularMemberCount = getRegularMemberCount();

    if (currentUser?.role !== 'holder') {
        window.alert('Only the main account holder can set the member limit.');
        return;
    }

    if (balanceOwnerId && balanceOwnerId !== currentUser.id) {
        window.alert('Only the original holder can change group settings.');
        return;
    }

    if (!savedUser || savedUser.password !== password) {
        window.alert('Please confirm your account password before changing the member limit.');
        return;
    }

    if (nextLimit !== null && (!Number.isInteger(nextLimit) || nextLimit < regularMemberCount)) {
        window.alert(`Please enter a whole number that is at least ${regularMemberCount}, or leave it empty for no limit.`);
        return;
    }

    memberLimit = nextLimit;
    balanceOwnerId = currentUser.id;

    if (memberLimit === null) {
        localStorage.removeItem(STORAGE_KEYS.memberLimit);
    } else {
        localStorage.setItem(STORAGE_KEYS.memberLimit, String(memberLimit));
    }

    localStorage.setItem(STORAGE_KEYS.balanceOwnerId, balanceOwnerId);
    document.getElementById('memberLimitPassword').value = '';
    updateBalanceControls();
    render();
}

function updateBalanceControls() {
    const input = document.getElementById('initialBalanceInput');
    const password = document.getElementById('balancePassword');
    const button = document.getElementById('setBalanceBtn');
    const notice = document.getElementById('balanceLockNotice');
    const limitInput = document.getElementById('memberLimitInput');
    const limitPassword = document.getElementById('memberLimitPassword');
    const limitButton = document.getElementById('setMemberLimitBtn');
    const limitNotice = document.getElementById('memberLimitNotice');
    const owner = users.find(user => user.id === balanceOwnerId);
    const isLockedByOther = Boolean(balanceOwnerId && balanceOwnerId !== currentUser?.id);

    input.disabled = isLockedByOther;
    password.disabled = isLockedByOther;
    button.disabled = isLockedByOther;
    limitInput.disabled = isLockedByOther;
    limitPassword.disabled = isLockedByOther;
    limitButton.disabled = isLockedByOther;

    if (!balanceOwnerId) {
        notice.textContent = 'The first holder who sets the balance will lock balance changes to their account.';
    } else if (isLockedByOther) {
        notice.textContent = `Balance changes are locked to ${owner?.name || 'the original holder'}.`;
    } else {
        notice.textContent = 'Balance changes are locked to your holder account and require your password.';
    }

    if (memberLimit === null) {
        limitNotice.textContent = `No regular member limit is set. Current regular members: ${getRegularMemberCount()}.`;
    } else {
        limitNotice.textContent = `Regular members allowed: ${getRegularMemberCount()} of ${memberLimit}.`;
    }
}

function render() {
    updateSummary();
    updateTable();
}

function updateSummary() {
    const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const uniqueMembers = new Set(expenses.map(expense => expense.memberName)).size;
    const remainingBalance = initialBalance - totalExpenses;
    const remainingElement = document.getElementById('remainingBalance');

    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('initialBalance').textContent = formatCurrency(initialBalance);
    remainingElement.textContent = formatCurrency(remainingBalance);
    remainingElement.classList.toggle('negative', remainingBalance < 0);
    document.getElementById('totalMembers').textContent = String(uniqueMembers);
    document.getElementById('registeredMembers').textContent = String(getRegularMemberCount());
    document.getElementById('memberLimitDisplay').textContent = memberLimit === null ? 'No limit' : String(memberLimit);
}

function updateTable() {
    const tbody = document.getElementById('memberTableBody');
    tbody.innerHTML = '';

    if (expenses.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.className = 'no-data';
        cell.textContent = 'No expenses added yet';
        return;
    }

    expenses.forEach(expense => {
        const row = tbody.insertRow();
        addCell(row, expense.memberName);
        addCell(row, categoryLabels[expense.category] || 'Other');
        addCell(row, formatCurrency(Number(expense.amount)));
        addCell(row, formatDate(expense.date));
        addCell(row, expense.description);
    });
}

function addCell(row, value) {
    const cell = row.insertCell();
    cell.textContent = value;
}

function formatCurrency(amount) {
    return currencyFormatter.format(amount);
}

function formatDate(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN');
}

function handlePrepareEmail() {
    const email = document.getElementById('holderEmail').value.trim();

    if (!email || !document.getElementById('holderEmail').checkValidity()) {
        showMessage('sendStatus', 'Please enter a valid email address.', 'error');
        return;
    }

    const subject = encodeURIComponent('Group Expense Summary');
    const body = encodeURIComponent(buildPlainTextSummary());
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    showMessage('sendStatus', 'Email draft opened in your mail app.', 'success');
}

function buildPlainTextSummary() {
    const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const lines = [
        'Group Expense Summary',
        '',
        `Total expenses: ${formatCurrency(totalExpenses)}`,
        `Initial balance: ${formatCurrency(initialBalance)}`,
        `Remaining balance: ${formatCurrency(initialBalance - totalExpenses)}`,
        `Total members: ${new Set(expenses.map(expense => expense.memberName)).size}`,
        '',
        'Expenses:'
    ];

    expenses.forEach(expense => {
        lines.push(
            `${expense.memberName} | ${categoryLabels[expense.category] || 'Other'} | ${formatCurrency(Number(expense.amount))} | ${formatDate(expense.date)} | ${expense.description}`
        );
    });

    return lines.join('\n');
}

function handleExport() {
    const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const summary = {
        totalExpenses,
        initialBalance,
        remainingBalance: initialBalance - totalExpenses,
        totalMembers: new Set(expenses.map(expense => expense.memberName)).size,
        expenses,
        generatedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expense-summary-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message ${type}`;

    window.setTimeout(() => {
        clearMessage(elementId);
    }, 3000);
}

function clearMessage(elementId) {
    const element = document.getElementById(elementId);
    element.textContent = '';
    element.className = 'status-message';
}

function normalizeName(name) {
    return name.trim().toLowerCase();
}

function getRegularMemberCount() {
    return users.filter(user => user.role === 'member').length;
}

function isMemberLimitReached() {
    return memberLimit !== null && getRegularMemberCount() >= memberLimit;
}

function toSessionUser(user) {
    return {
        id: user.id,
        name: user.name,
        role: user.role
    };
}

function createId() {
    return window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}
