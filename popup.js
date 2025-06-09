// popup.js

const newWordInput = document.getElementById('newWordInput');
const addWordButton = document.getElementById('addWordButton');
const wordListUl = document.getElementById('wordList');
const messageParagraph = document.getElementById('message');

let currentTargetSites = []; // Holds the current list of target sites

// Function to load target sites from storage
async function loadTargetSites() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['targetSites'], (result) => {
            if (result.targetSites) {
                currentTargetSites = result.targetSites;
            } else {
                // Default sites if none are in storage (first run)
                currentTargetSites = ["shorts", "x.com", "instagram", "facebook"];
            }
            resolve();
        });
    });
}

// Function to save target sites to storage
async function saveTargetSites() {
    return new Promise((resolve) => {
        chrome.storage.sync.set({ 'targetSites': currentTargetSites }, () => {
            // Send a message to the background script to update its list
            chrome.runtime.sendMessage({ action: "updateTargetSites" });
            resolve();
        });
    });
}

// Function to render the list in the UI
function renderWordList() {
    wordListUl.innerHTML = ''; // Clear existing list
    if (currentTargetSites.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No sites added yet.';
        li.style.fontStyle = 'italic';
        li.style.color = '#777';
        wordListUl.appendChild(li);
        return;
    }

    currentTargetSites.forEach((word, index) => {
        const li = document.createElement('li');
        li.textContent = word;

        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.classList.add('removeButton');
        removeButton.dataset.index = index; // Store index to identify which item to remove
        removeButton.addEventListener('click', removeWord);

        li.appendChild(removeButton);
        wordListUl.appendChild(li);
    });
}

// Function to add a word/domain
async function addWord() {
    const newWord = newWordInput.value.trim().toLowerCase();
    if (newWord && !currentTargetSites.includes(newWord)) {
        currentTargetSites.push(newWord);
        newWordInput.value = ''; // Clear input
        await saveTargetSites();
        renderWordList();
        showMessage(`'${newWord}' added.`);
    } else if (currentTargetSites.includes(newWord)) {
        showMessage(`'${newWord}' is already in the list.`, 'error');
    } else {
        showMessage('Please enter a word or domain.', 'error');
    }
}

// Function to remove a word/domain
async function removeWord(event) {
    const indexToRemove = parseInt(event.target.dataset.index);
    if (!isNaN(indexToRemove) && indexToRemove >= 0 && indexToRemove < currentTargetSites.length) {
        const removedWord = currentTargetSites.splice(indexToRemove, 1)[0];
        await saveTargetSites();
        renderWordList();
        showMessage(`'${removedWord}' removed.`);
    }
}

// Function to display temporary messages
let messageTimeout;
function showMessage(msg, type = 'info') {
    clearTimeout(messageTimeout);
    messageParagraph.textContent = msg;
    messageParagraph.style.color = type === 'error' ? '#f44336' : '#666';
    messageTimeout = setTimeout(() => {
        messageParagraph.textContent = '';
    }, 3000); // Message disappears after 3 seconds
}

// Event Listeners
addWordButton.addEventListener('click', addWord);
newWordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addWord();
    }
});

// Initialize on popup load
document.addEventListener('DOMContentLoaded', async () => {
    await loadTargetSites();
    renderWordList();
});