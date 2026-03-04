// --- Firebase Configuration and Initialization ---
// IMPORTANT: This is your specific project's connection details.
const firebaseConfig = {
    apiKey: "AIzaSyD_AnGX-RO7zfM_rCBopJmdv3BOVE4V-_o",
    authDomain: "media-app-a702b.firebaseapp.com",
    projectId: "media-app-a702b",
    storageBucket: "media-app-a702b.firebasestorage.app",
    messagingSenderId: "60484045851",
    appId: "1:60484045851:web:f1bb588c2d5edc177ffcbe",
    measurementId: "G-LPBXF7MLWF"
};

// Your secret key for write access (for demonstration, in a real app, use Firebase Auth)
const ADMIN_SECRET_KEY = "NewRuiruMediaKey2025!";

// Import Firebase functions from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, query, where, onSnapshot, updateDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";

// Initialize Firebase app, Firestore, and Storage instances
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const contentCollectionRef = collection(db, "content_items");
const launchpadPluginsCollectionRef = collection(db, "LaunchpadPlugins");

// --- Global Variables and DOM Elements ---
let activeSection = 'home';
let currentSearchTerm = '';
let editingDocId = null; // Stores the ID of the document being edited
let launchpadPluginsUnsubscribe = null;
let launchpadPluginsCache = [];
let editingLaunchpadPluginId = null;
let editingLaunchpadPluginImageUrl = '';
let launchpadActivePreviewPluginId = null;

// DOM Elements
const sidebarWrapper = document.querySelector('.sidebar-wrapper');
const menuToggle = document.querySelector('.menu-toggle');
const navItems = document.querySelectorAll('.nav-item');
const contentSections = document.querySelectorAll('.content-section');
const searchInput = document.getElementById('searchInput');

// Modal Elements
const addContentModal = document.getElementById('addContentModal');
const closeButton = document.querySelector('.close-button');
const modalTitle = document.getElementById('modalTitle');
const addContentForm = document.getElementById('addContentForm');
const contentEntriesContainer = document.getElementById('contentEntriesContainer');
const addMoreContentBtn = document.getElementById('addMoreContentBtn');
const saveContentBtn = document.getElementById('saveContentBtn');

// Launchpad modal and actions
const launchpadPluginBtn = document.getElementById('launchpadPluginBtn');
const launchpadBlankBtn = document.getElementById('launchpadBlankBtn');
const launchpadPluginModal = document.getElementById('launchpadPluginModal');
const launchpadBlankModal = document.getElementById('launchpadBlankModal');
const launchpadPluginCloseBtn = document.querySelector('.launchpad-plugin-close');
const launchpadBlankCloseBtn = document.querySelector('.launchpad-blank-close');
const launchpadPluginForm = document.getElementById('launchpadPluginForm');
const launchpadPluginSaveBtn = document.getElementById('launchpadPluginSaveBtn');
const launchpadPluginNameInput = document.getElementById('launchpadPluginName');
const launchpadPluginImageFileInput = document.getElementById('launchpadPluginImageFile');
const launchpadPluginImageUrlInput = document.getElementById('launchpadPluginImageUrl');
const launchpadPluginUrlInput = document.getElementById('launchpadPluginUrl');
const launchpadPluginVisibilityInput = document.getElementById('launchpadPluginVisibility');
const launchpadPluginCancelBtn = document.getElementById('launchpadPluginCancelBtn');
const launchpadSection = document.getElementById('launchpad-section');
const launchpadContentContainer = document.getElementById('launchpad-container');
const launchpadBackendViewer = document.getElementById('launchpadBackendViewer');
const launchpadBackendViewerTitle = document.getElementById('launchpadBackendViewerTitle');
const launchpadBackendViewerHost = document.getElementById('launchpadBackendViewerHost');
const launchpadBackendViewerCloseBtn = document.getElementById('launchpadBackendViewerCloseBtn');
const launchpadBackendIframe = document.getElementById('launchpadBackendIframe');

// Homepage Buttons
const fixedUploadButton = document.getElementById('fixedUploadButton');
const viewArchiveButton = document.getElementById('viewArchiveButton');

// Confirmation Modal Elements
const confirmationModal = document.getElementById('confirmationModal');
const confirmationMessage = document.getElementById('confirmationMessage');
const confirmYesBtn = document.getElementById('confirmYes');
const confirmNoBtn = document.getElementById('confirmNo');

// Toast Container
const toastContainer = document.getElementById('toastContainer');

// --- Event Listeners on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Mobile Hamburger Menu Toggle ---
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebarWrapper.classList.toggle('active');
        });
    }

    // --- Navigation and Content Switching Logic ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSectionId = e.currentTarget.dataset.section + '-section';
            const targetSectionName = e.currentTarget.dataset.section;

            if (targetSectionName !== 'launchpad') {
                closeLaunchpadBackendPreview();
            }

            activeSection = targetSectionName;
            searchInput.value = ''; // Clear search input visually
            currentSearchTerm = ''; // Reset search term state

            // Update active navigation item
            navItems.forEach(nav => nav.classList.remove('active'));
            e.currentTarget.classList.add('active');

            // Show/hide content sections
            contentSections.forEach(section => section.classList.remove('active'));
            const targetSection = document.getElementById(targetSectionId);
            if (targetSection) {
                targetSection.classList.add('active');
                // Auto-close sidebar on mobile after selection
                if (window.innerWidth <= 768 && sidebarWrapper.classList.contains('active')) {
                    sidebarWrapper.classList.remove('active');
                }
            }

            // Load content for the selected section (unless it's home)
            if (activeSection !== 'home') {
                if (activeSection === 'launchpad') {
                    loadLaunchpadPlugins(currentSearchTerm);
                } else {
                    loadContentFirebase(activeSection, currentSearchTerm);
                }
            }
        });
    });

    // --- Search Functionality ---
    searchInput.addEventListener('input', () => {
        currentSearchTerm = searchInput.value.trim();
        if (activeSection !== 'home') {
            if (activeSection === 'launchpad') {
                loadLaunchpadPlugins(currentSearchTerm);
            } else {
                loadContentFirebase(activeSection, currentSearchTerm);
            }
        }
    });

    // --- Fixed Upload Button Click (on Homepage) ---
    if (fixedUploadButton) {
        fixedUploadButton.addEventListener('click', () => {
            editingDocId = null; // Ensure we're in 'add' mode
            modalTitle.textContent = 'Add New Content';
            saveContentBtn.textContent = 'Save Content';
            contentEntriesContainer.innerHTML = ''; // Clear previous entries
            addContentEntry(); // Add one empty content entry
            addMoreContentBtn.style.display = 'block'; // Show "Add More" button
            addContentModal.classList.add('active'); // Show modal
        });
    }

    // --- View Archive Button Click (on Homepage) ---
    if (viewArchiveButton) {
        viewArchiveButton.addEventListener('click', (e) => {
            e.preventDefault();
            // Simulate clicking the archive nav item
            document.querySelector('.nav-item[data-section="archive"]').click();
        });
    }

    // --- Launchpad: action buttons ---
    if (launchpadPluginBtn) {
        launchpadPluginBtn.addEventListener('click', openLaunchpadPluginModal);
    }
    if (launchpadBlankBtn) {
        launchpadBlankBtn.addEventListener('click', openLaunchpadBlankModal);
    }
    if (launchpadPluginCloseBtn) {
        launchpadPluginCloseBtn.addEventListener('click', closeLaunchpadPluginModal);
    }
    if (launchpadPluginCancelBtn) {
        launchpadPluginCancelBtn.addEventListener('click', closeLaunchpadPluginModal);
    }
    if (launchpadBackendViewerCloseBtn) {
        launchpadBackendViewerCloseBtn.addEventListener('click', closeLaunchpadBackendPreview);
    }
    if (launchpadBlankCloseBtn) {
        launchpadBlankCloseBtn.addEventListener('click', closeLaunchpadBlankModal);
    }
    if (launchpadPluginForm) {
        // Temporarily disabled for development:
        // use explicit JS validation/toasts instead of silent native form blocking.
        launchpadPluginForm.setAttribute('novalidate', 'novalidate');
        launchpadPluginForm.addEventListener('submit', handleLaunchpadPluginSubmit);
    }
    if (launchpadPluginSaveBtn && launchpadPluginForm) {
        launchpadPluginSaveBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            launchpadPluginForm.requestSubmit();
        });
    }

    // --- Modal Close Button ---
    closeButton.addEventListener('click', () => {
        addContentModal.classList.remove('active');
        addContentForm.reset(); // Reset form fields
        contentEntriesContainer.innerHTML = ''; // Clear dynamic entries
        editingDocId = null; // Clear editing state
        showToast('Upload/Edit cancelled.', 'info');
    });

    // --- Close Modal when clicking outside ---
    window.addEventListener('click', (e) => {
        if (e.target === addContentModal) {
            addContentModal.classList.remove('active');
            addContentForm.reset();
            contentEntriesContainer.innerHTML = '';
            editingDocId = null;
            showToast('Upload/Edit cancelled.', 'info');
        } else if (e.target === confirmationModal) { // Also allow closing confirmation modal by clicking outside
            confirmationModal.classList.remove('active');
            // Important: Do not resolve the promise here, as it would imply a 'cancel'
            // The promise is resolved by clicking Yes/No buttons
        } else if (e.target === launchpadPluginModal) {
            closeLaunchpadPluginModal();
        } else if (e.target === launchpadBlankModal) {
            closeLaunchpadBlankModal();
        }
    });

    // --- Add More Content Item Button in Modal ---
    addMoreContentBtn.addEventListener('click', () => {
        addContentEntry();
    });

    // --- Handle form submission for adding/editing content to Firestore ---
    addContentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const contentEntries = contentEntriesContainer.querySelectorAll('.content-entry');
        if (contentEntries.length === 0) {
            showToast('Please add at least one content item.', 'error');
            return;
        }

        const uploadPromises = [];
        const contentToProcess = [];
        let hasErrors = false;

        for (const entry of contentEntries) {
            const entryId = entry.dataset.entryId;
            const categorySelect = entry.querySelector('.content-category');
            const titleInput = entry.querySelector('.content-title');
            const descriptionInput = entry.querySelector('.content-description');
            const eventTimeInput = entry.querySelector('.content-time');
            const topicInput = entry.querySelector('.content-topic');
            const byInput = entry.querySelector('.content-by');
            const eventDateInput = entry.querySelector('.content-event-date');
            const fileInput = entry.querySelector('.content-file');
            const urlInput = entry.querySelector('.content-url');

            const category = categorySelect.value;
            const title = titleInput.value.trim();
            const description = descriptionInput.value.trim();
            const eventTime = eventTimeInput.value.trim();
            const topic = topicInput.value.trim();
            const by = byInput.value.trim();
            const eventDate = eventDateInput.value; // YYYY-MM-DD string

            if (!category || !title || !eventDate) {
                showToast('Category, Title, and Event Date are required for all items.', 'error');
                hasErrors = true;
                break;
            }

            let file = fileInput.files[0];
            let contentUrl = urlInput.value.trim();
            let mediaUrl = '';

            if (file) {
                // Handle file upload
                const storageRef = ref(storage, `${category}/${Date.now()}-${file.name}`);
                const uploadTask = uploadBytesResumable(storageRef, file);

                const uploadPromise = new Promise((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snapshot) => {
                            // Optional: handle progress
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            // console.log(`Upload is ${progress}% done for ${file.name}`);
                        },
                        (error) => {
                            showToast(`Upload failed for ${file.name}: ${error.message}`, 'error');
                            reject(error);
                        },
                        async () => {
                            try {
                                mediaUrl = await getDownloadURL(uploadTask.snapshot.ref);
                                resolve(mediaUrl);
                            } catch (error) {
                                showToast(`Failed to get download URL for ${file.name}: ${error.message}`, 'error');
                                reject(error);
                            }
                        }
                    );
                });
                uploadPromises.push(uploadPromise);
                contentToProcess.push({
                    id: editingDocId || null,
                    category, title, description, eventTime, topic, by, eventDate,
                    url: 'UPLOADING_PLACEHOLDER', // Placeholder
                    timestamp: serverTimestamp(),
                    adminKey: ADMIN_SECRET_KEY,
                    isArchived: false // New content always starts as not archived
                });

            } else if (contentUrl) {
                // Use provided URL if no file
                mediaUrl = contentUrl;
                contentToProcess.push({
                    id: editingDocId || null,
                    category, title, description, eventTime, topic, by, eventDate,
                    url: mediaUrl,
                    timestamp: serverTimestamp(),
                    adminKey: ADMIN_SECRET_KEY,
                    isArchived: false
                });
            } else {
                // Neither file nor URL provided for this entry
                showToast(`No media (file or URL) provided for "${title}".`, 'error');
                hasErrors = true;
                break;
            }
        }

        if (hasErrors) {
            return;
        }

        showToast('Processing content items...', 'info', 5000); // Show a persistent info toast

        try {
            const uploadedUrls = await Promise.all(uploadPromises);

            // Update contentToProcess with actual URLs from resolved promises
            let uploadedIndex = 0;
            for (let i = 0; i < contentToProcess.length; i++) {
                if (contentToProcess[i].url === 'UPLOADING_PLACEHOLDER') {
                    contentToProcess[i].url = uploadedUrls[uploadedIndex++];
                }
            }

            // Process each content item (add or update)
            for (const contentItem of contentToProcess) {
                if (contentItem.id) { // If editing an existing item
                    const docRef = doc(db, "content_items", contentItem.id);
                    await updateDoc(docRef, {
                        category: contentItem.category,
                        title: contentItem.title,
                        description: contentItem.description,
                        eventTime: contentItem.eventTime,
                        topic: contentItem.topic,
                        by: contentItem.by,
                        eventDate: contentItem.eventDate,
                        url: contentItem.url,
                        // isArchived status is preserved on edit, not changed here
                        // timestamp is not updated on edit unless explicitly needed
                        adminKey: ADMIN_SECRET_KEY
                    });
                    showToast(`Content "${contentItem.title}" updated successfully!`, 'success');
                } else { // Adding a new item
                    await addDoc(contentCollectionRef, contentItem);
                    showToast(`Content "${contentItem.title}" added successfully!`, 'success');
                }
            }

            addContentModal.classList.remove('active');
            addContentForm.reset();
            contentEntriesContainer.innerHTML = ''; // Clear dynamic entries
            editingDocId = null; // Clear editing state

        } catch (error) {
            console.error("Error saving content: ", error);
            showToast(`Error saving content: ${error.message}`, 'error');
        }
    });

    // --- Initial Page Load ---
    // Simulate clicking the home nav item to load initial content
    const initialNavItem = document.querySelector('.nav-item[data-section="home"]');
    if (initialNavItem) {
        initialNavItem.click();
    }
});

// --- Helper Functions ---

/**
 * Generates a unique ID for dynamic content entries in the modal.
 * @returns {string} A unique ID.
 */
function generateUniqueId() {
    return 'entry-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

/**
 * Creates and appends a new content entry form group to the modal.
 * @param {Object} [data={}] - Optional data to pre-populate the form (for editing).
 * @param {string} [docId=null] - Optional Firestore document ID for editing.
 */
function addContentEntry(data = {}, docId = null) {
    const entryId = docId || generateUniqueId();
    const contentEntryDiv = document.createElement('div');
    contentEntryDiv.classList.add('content-entry');
    contentEntryDiv.dataset.entryId = entryId; // Store unique ID

    // If in edit mode, hide "Add More" button and "Remove Entry" button
    if (editingDocId) {
        addMoreContentBtn.style.display = 'none';
    }

    contentEntryDiv.innerHTML = `
        <h3>${docId ? 'Edit Content' : 'New Content Item'}</h3>
        ${!editingDocId ? `<button type="button" class="remove-entry-btn" title="Remove this item">&times;</button>` : ''}

        <label for="category-${entryId}">Content Type:</label>
        <select id="category-${entryId}" class="content-category" required>
            <option value="">Select Category</option>
            <option value="sermons">Sermons LIVE</option>
            <option value="entertainment">Entertainment</option>
            <option value="bible-study">Bible Study</option>
            <option value="events">Events</option>
            <option value="launchpad" disabled>Launchpad (use Plugin +)</option>
        </select>

        <label for="title-${entryId}">Title:</label>
        <input type="text" id="title-${entryId}" class="content-title" required value="${data.title || ''}">

        <label for="description-${entryId}">Description:</label>
        <textarea id="description-${entryId}" class="content-description">${data.description || ''}</textarea>

        <label for="eventDate-${entryId}">Event Date:</label>
        <input type="date" id="eventDate-${entryId}" class="content-event-date" required value="${data.eventDate || ''}">

        <label for="time-${entryId}">Time (e.g., 12:22 - 1:17):</label>
        <input type="text" id="time-${entryId}" class="content-time" value="${data.eventTime || ''}">

        <label for="topic-${entryId}">Topic:</label>
        <input type="text" id="topic-${entryId}" class="content-topic" value="${data.topic || ''}">

        <label for="by-${entryId}">By:</label>
        <input type="text" id="by-${entryId}" class="content-by" value="${data.by || ''}">

        <div class="file-upload-wrapper">
            <label for="file-${entryId}">Upload Media File (Optional):</label>
            <input type="file" id="file-${entryId}" class="content-file" accept="video/*,audio/*,image/*">
            <p class="file-upload-info">Max file size: 50MB (example)</p>
        </div>

        <label for="url-${entryId}">Or External URL (Optional):</label>
        <input type="url" id="url-${entryId}" class="content-url" placeholder="e.g., https://www.youtube.com/watch?v=VIDEO_ID" value="${data.url && !data.url.startsWith('https://firebasestorage.googleapis.com/') ? data.url : ''}">
        ${data.url && data.url.startsWith('https://firebasestorage.googleapis.com/') ? `<p class="file-upload-info">Current uploaded file: <a href="${data.url}" target="_blank">View File</a></p>` : ''}
    `;

    contentEntriesContainer.appendChild(contentEntryDiv);

    // Pre-select category if data is provided (for edit mode)
    if (data.category) {
        contentEntryDiv.querySelector('.content-category').value = data.category;
    }

    // Add event listener for removing a dynamic entry (only in add mode)
    if (!editingDocId) {
        const removeButton = contentEntryDiv.querySelector('.remove-entry-btn');
        if (removeButton) {
            removeButton.addEventListener('click', () => {
                contentEntryDiv.remove();
                if (contentEntriesContainer.children.length === 0) {
                    addContentEntry(); // Ensure at least one entry remains
                }
            });
        }
    }
}


/**
 * Extracts YouTube video ID from various YouTube URL formats.
 * @param {string} url - The YouTube URL.
 * @returns {string|null} The YouTube video ID or null if not found.
 */
function getYouTubeVideoId(url) {
    let videoId = null;
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
    const match = url.match(regex);
    if (match && match[1]) {
        videoId = match[1];
    }
    return videoId;
}

/**
 * Displays a custom toast notification.
 * @param {string} message - The message to display.
 * @param {string} type - 'success', 'error', or 'info'.
 * @param {number} duration - How long the toast should be visible in milliseconds.
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.classList.add('toast', type);
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Show the toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10); // Small delay for CSS transition

    // Hide and remove the toast after duration
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, duration);
}

/**
 * Shows a custom confirmation modal.
 * This function is ONLY called when a user explicitly clicks a delete or restore button.
 * It is NOT called on page load.
 * @param {string} message - The confirmation message.
 * @returns {Promise<boolean>} Resolves to true if confirmed, false otherwise.
 */
function showConfirmation(message) {
    console.log("showConfirmation called with message:", message); // Debugging log
    return new Promise((resolve) => {
        confirmationMessage.textContent = message;
        confirmationModal.classList.add('active'); // This makes the modal visible

        const onConfirm = () => {
            confirmationModal.classList.remove('active');
            confirmYesBtn.removeEventListener('click', onConfirm);
            confirmNoBtn.removeEventListener('click', onCancel);
            resolve(true);
        };

        const onCancel = () => {
            confirmationModal.classList.remove('active');
            confirmYesBtn.removeEventListener('click', onConfirm);
            confirmNoBtn.removeEventListener('click', onCancel);
            resolve(false);
        };

        // Ensure event listeners are clean to prevent multiple bindings
        confirmYesBtn.removeEventListener('click', onConfirm);
        confirmNoBtn.removeEventListener('click', onCancel);

        confirmYesBtn.addEventListener('click', onConfirm);
        confirmNoBtn.addEventListener('click', onCancel);
    });
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"'`=\/]/g, (s) => {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;', '/': '&#47;' })[s];
    });
}

function normalizeUrl(rawUrl) {
    if (!rawUrl) return '';
    let url = rawUrl.trim();
    if (
        (url.startsWith('"') && url.endsWith('"')) ||
        (url.startsWith("'") && url.endsWith("'"))
    ) {
        url = url.slice(1, -1).trim();
    }
    if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
    }
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
        return parsed.toString();
    } catch (error) {
        return '';
    }
}

function extractGoogleDriveFileId(rawUrl) {
    if (!rawUrl) return '';
    const raw = String(rawUrl).trim();

    const parseCandidates = [];
    if (/^https?:\/\//i.test(raw)) {
        parseCandidates.push(raw);
    } else {
        parseCandidates.push(`https://${raw}`);
    }

    for (const candidate of parseCandidates) {
        try {
            const parsed = new URL(candidate);
            const pathname = decodeURIComponent(parsed.pathname || '');

            const fromQuery =
                parsed.searchParams.get('id') ||
                parsed.searchParams.get('fileId') ||
                '';
            if (fromQuery) return fromQuery.trim();

            const fileMatch = pathname.match(/\/file\/d\/([^/?#]+)/i);
            if (fileMatch?.[1]) return fileMatch[1];

            const genericMatch = pathname.match(/\/d\/([^/?#]+)/i);
            if (genericMatch?.[1]) return genericMatch[1];
        } catch (error) {
            // Fall through to regex pass below.
        }
    }

    const regexMatches = [
        raw.match(/\/file\/d\/([^/?#]+)/i),
        raw.match(/\/d\/([^/?#]+)/i),
        raw.match(/[?&]id=([^&?#]+)/i)
    ];
    for (const match of regexMatches) {
        if (match?.[1]) {
            return decodeURIComponent(match[1]).trim();
        }
    }

    return '';
}

function normalizeGoogleDriveImageUrl(rawUrl) {
    const normalized = normalizeUrl(rawUrl);
    if (!normalized) return '';

    try {
        const parsed = new URL(normalized);
        const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();
        const isGoogleDriveHost =
            hostname === 'drive.google.com' ||
            hostname === 'docs.google.com' ||
            hostname.endsWith('.googleusercontent.com');
        if (!isGoogleDriveHost) return normalized;

        const fileId = extractGoogleDriveFileId(normalized) || extractGoogleDriveFileId(rawUrl);
        if (!fileId) {
            console.warn('Could not extract Google Drive file id from image URL:', rawUrl);
            return normalized;
        }
        return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
    } catch (error) {
        return normalized;
    }
}

function getGoogleDriveImageFallbackUrls(rawUrl, normalizedUrl = '') {
    const fileId = extractGoogleDriveFileId(normalizedUrl) || extractGoogleDriveFileId(rawUrl);
    if (!fileId) return [];

    const encodedId = encodeURIComponent(fileId);
    const candidates = [
        normalizedUrl || normalizeGoogleDriveImageUrl(rawUrl),
        `https://drive.google.com/thumbnail?id=${encodedId}&sz=w1200`,
        `https://lh3.googleusercontent.com/d/${encodedId}=s1200`,
        `https://drive.google.com/uc?export=download&id=${encodedId}`
    ];

    const unique = [];
    const seen = new Set();
    candidates.forEach((candidate) => {
        const normalizedCandidate = normalizeUrl(candidate);
        if (!normalizedCandidate || seen.has(normalizedCandidate)) return;
        seen.add(normalizedCandidate);
        unique.push(normalizedCandidate);
    });

    return unique;
}

function resolveHostLabel(url) {
    try {
        return new URL(url).hostname.replace(/^www\./i, '');
    } catch (error) {
        return 'Unknown Host';
    }
}

function syncLaunchpadPreviewSelection() {
    document.querySelectorAll('#launchpad-container .launchpad-plugin-card').forEach((card) => {
        const isActive = card.dataset.pluginId === launchpadActivePreviewPluginId;
        card.classList.toggle('preview-active', isActive);
    });
}

function setLaunchpadBackendPreviewMode(isOpen) {
    if (!launchpadSection || !launchpadContentContainer || !launchpadBackendViewer) return;
    launchpadSection.classList.toggle('plugin-preview-open', Boolean(isOpen));
    if (isOpen) {
        launchpadContentContainer.setAttribute('aria-hidden', 'true');
    } else {
        launchpadContentContainer.removeAttribute('aria-hidden');
    }
}

function openLaunchpadBackendPreview(plugin) {
    if (!plugin || !plugin.id || !launchpadBackendViewer || !launchpadBackendIframe) return;

    const pluginUrl = normalizeUrl(plugin.projectUrl || plugin.url || '');
    if (!pluginUrl) {
        console.warn('[Launchpad][Admin] Invalid plugin URL for preview:', plugin?.projectUrl || plugin?.url || '');
        showToast('Cannot preview plugin: invalid project URL.', 'error', 3500);
        return;
    }

    const pluginTitle = plugin.title || plugin.name || 'Untitled Plugin';
    launchpadActivePreviewPluginId = plugin.id;
    if (launchpadBackendViewerTitle) {
        launchpadBackendViewerTitle.textContent = pluginTitle;
    }
    if (launchpadBackendViewerHost) {
        launchpadBackendViewerHost.textContent = resolveHostLabel(pluginUrl);
    }

    setLaunchpadBackendPreviewMode(true);
    launchpadBackendIframe.src = pluginUrl;
    syncLaunchpadPreviewSelection();
}

function closeLaunchpadBackendPreview() {
    if (!launchpadBackendViewer || !launchpadBackendIframe) return;
    setLaunchpadBackendPreviewMode(false);
    launchpadBackendIframe.src = 'about:blank';
    launchpadActivePreviewPluginId = null;
    syncLaunchpadPreviewSelection();
}

function openLaunchpadPluginModal(isEditMode = false) {
    if (!launchpadPluginModal) return;
    if (!isEditMode) {
        editingLaunchpadPluginId = null;
        editingLaunchpadPluginImageUrl = '';
        if (launchpadPluginForm) launchpadPluginForm.reset();
        const modalHeading = launchpadPluginModal.querySelector('h2');
        if (modalHeading) modalHeading.textContent = 'Add Launchpad Plugin';
        if (launchpadPluginSaveBtn) launchpadPluginSaveBtn.textContent = 'Save Plugin';
    }
    launchpadPluginModal.classList.add('active');
    if (launchpadPluginNameInput) {
        setTimeout(() => launchpadPluginNameInput.focus(), 120);
    }
}

function closeLaunchpadPluginModal() {
    if (!launchpadPluginModal) return;
    launchpadPluginModal.classList.remove('active');
    if (launchpadPluginForm) launchpadPluginForm.reset();
    editingLaunchpadPluginId = null;
    editingLaunchpadPluginImageUrl = '';
    const modalHeading = launchpadPluginModal.querySelector('h2');
    if (modalHeading) modalHeading.textContent = 'Add Launchpad Plugin';
    if (launchpadPluginSaveBtn) launchpadPluginSaveBtn.textContent = 'Save Plugin';
}

function openLaunchpadBlankModal() {
    if (!launchpadBlankModal) return;
    launchpadBlankModal.classList.add('active');
}

function closeLaunchpadBlankModal() {
    if (!launchpadBlankModal) return;
    launchpadBlankModal.classList.remove('active');
}

async function handleLaunchpadPluginSubmit(e) {
    e.preventDefault();

    const isEditingLaunchpadPlugin = Boolean(editingLaunchpadPluginId);
    const title = launchpadPluginNameInput?.value?.trim() || '';
    const hostedUrl = normalizeUrl(launchpadPluginUrlInput?.value || '');
    const rawImageUrlInput = launchpadPluginImageUrlInput?.value || '';
    const imageUrlInput = normalizeGoogleDriveImageUrl(rawImageUrlInput);
    const imageFile = launchpadPluginImageFileInput?.files?.[0] || null;
    const visibility = (launchpadPluginVisibilityInput?.value || '').trim().toLowerCase();
    const adminKey = ADMIN_SECRET_KEY;
    // Temporarily disabled for development
    // createdBy is fixed to a development marker instead of auth state.
    const currentUserUid = 'dev-temp-user';

    // Temporarily disabled for development
    // Launchpad plugin creation no longer requires sign-in during development.

    if (!title) {
        showToast('Title is required.', 'error');
        return;
    }

    if (!hostedUrl) {
        showToast('Hosted URL must be a valid http(s) URL.', 'error');
        return;
    }

    if (visibility !== 'public' && visibility !== 'private') {
        showToast('Visibility is required. Choose Public or Private.', 'error');
        return;
    }

    if (!imageFile && !imageUrlInput && !editingLaunchpadPluginImageUrl) {
        showToast('Please upload an icon or provide an image URL.', 'error');
        return;
    }

    if (!adminKey) {
        console.error('Launchpad plugin save blocked: ADMIN_SECRET_KEY is missing.');
        showToast('Save blocked: admin key configuration is missing.', 'error', 5000);
        return;
    }

    console.log('[Launchpad][Admin][Save] Image URL input normalization:', {
        rawImageUrlInput,
        normalizedImageUrlInput: imageUrlInput
    });

    let resolvedImageUrl = imageUrlInput || normalizeGoogleDriveImageUrl(editingLaunchpadPluginImageUrl);
    if (launchpadPluginSaveBtn) {
        launchpadPluginSaveBtn.disabled = true;
        launchpadPluginSaveBtn.textContent = isEditingLaunchpadPlugin ? 'Updating...' : 'Saving...';
    }
    showToast(isEditingLaunchpadPlugin ? 'Updating Launchpad plugin...' : 'Saving Launchpad plugin...', 'info', 1800);

    try {
        if (imageFile) {
            const storageRef = ref(storage, `launchpad/icons/${Date.now()}-${imageFile.name}`);
            const uploadTask = uploadBytesResumable(storageRef, imageFile);

            resolvedImageUrl = await new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    () => {},
                    (error) => reject(error),
                    async () => {
                        try {
                            const url = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve(url);
                        } catch (error) {
                            reject(error);
                        }
                    }
                );
            });
        }
        resolvedImageUrl = normalizeGoogleDriveImageUrl(resolvedImageUrl);
        console.log('[Launchpad][Admin][Save] Final imageUrl before Firestore write:', resolvedImageUrl);

        const payload = {
            title,
            imageUrl: resolvedImageUrl,
            projectUrl: hostedUrl,
            visibility,
            name: title,
            image: resolvedImageUrl,
            url: hostedUrl,
            adminKey
        };

        if (isEditingLaunchpadPlugin) {
            await updateDoc(doc(db, "LaunchpadPlugins", editingLaunchpadPluginId), {
                ...payload,
                updatedAt: serverTimestamp()
            });
        } else {
            await addDoc(launchpadPluginsCollectionRef, {
                ...payload,
                createdBy: currentUserUid,
                timestamp: serverTimestamp()
            });
        }

        closeLaunchpadPluginModal();
        showToast(`Launchpad plugin "${title}" ${isEditingLaunchpadPlugin ? 'updated' : 'saved'} successfully.`, 'success');
    } catch (error) {
        console.error(`Error ${isEditingLaunchpadPlugin ? 'updating' : 'saving'} Launchpad plugin:`, error);
        if (error?.code === 'permission-denied') {
            console.error('Firestore rule validation failed. Ensure adminKey is present and matches rule value.');
        }
        if (imageFile && !imageUrlInput) {
            showToast('Icon upload failed. Try using Profile Image URL (without file upload).', 'error', 5000);
        }
        showToast(`Failed to ${isEditingLaunchpadPlugin ? 'update' : 'save'} Launchpad plugin: ${error.message}`, 'error', 5000);
    } finally {
        if (launchpadPluginSaveBtn) {
            launchpadPluginSaveBtn.disabled = false;
            launchpadPluginSaveBtn.textContent = editingLaunchpadPluginId ? 'Update Plugin' : 'Save Plugin';
        }
    }
}

function editLaunchpadPlugin(plugin) {
    if (!plugin || !plugin.id) return;
    editingLaunchpadPluginId = plugin.id;
    editingLaunchpadPluginImageUrl = plugin.imageUrl || plugin.image || '';
    const pluginVisibility = (plugin.visibility || '').toLowerCase();

    if (launchpadPluginNameInput) {
        launchpadPluginNameInput.value = plugin.title || plugin.name || '';
    }
    if (launchpadPluginUrlInput) {
        launchpadPluginUrlInput.value = plugin.projectUrl || plugin.url || '';
    }
    if (launchpadPluginImageUrlInput) {
        launchpadPluginImageUrlInput.value = editingLaunchpadPluginImageUrl;
    }
    if (launchpadPluginImageFileInput) {
        launchpadPluginImageFileInput.value = '';
    }
    if (launchpadPluginVisibilityInput) {
        launchpadPluginVisibilityInput.value = pluginVisibility === 'public' || pluginVisibility === 'private'
            ? pluginVisibility
            : 'private';
    }

    const modalHeading = launchpadPluginModal?.querySelector('h2');
    if (modalHeading) modalHeading.textContent = 'Edit Launchpad Plugin';
    if (launchpadPluginSaveBtn) launchpadPluginSaveBtn.textContent = 'Update Plugin';
    openLaunchpadPluginModal(true);
}

function renderLaunchpadPlugins(searchTerm = '') {
    const contentContainer = document.getElementById('launchpad-container');
    if (!contentContainer) return;

    const normalizedSearch = (searchTerm || '').toLowerCase();
    const filteredPlugins = launchpadPluginsCache.filter((plugin) => {
        const hostLabel = resolveHostLabel(plugin.url || '');
        const visibilityLabel = plugin.visibility === 'public' ? 'public' : 'private';
        return !normalizedSearch ||
            (plugin.name || '').toLowerCase().includes(normalizedSearch) ||
            (plugin.url || '').toLowerCase().includes(normalizedSearch) ||
            hostLabel.toLowerCase().includes(normalizedSearch) ||
            visibilityLabel.includes(normalizedSearch);
    });

    contentContainer.innerHTML = '';

    if (filteredPlugins.length === 0) {
        const emptyMessage = normalizedSearch
            ? `No Launchpad plugins match "${escapeHtml(searchTerm)}".`
            : 'No Launchpad plugins yet. Click "Plugin +" to add one.';
        contentContainer.innerHTML = `<p class="text-center-message">${emptyMessage}</p>`;
        return;
    }

    filteredPlugins.forEach((plugin) => {
        const card = document.createElement('article');
        card.className = 'launchpad-plugin-card';
        card.dataset.pluginId = plugin.id;
        const visibility = plugin.visibility === 'public' ? 'public' : 'private';
        const visibilityLabel = visibility === 'public' ? 'Public' : 'Private';

        const media = plugin.image
            ? `<img src="${escapeHtml(plugin.image)}" alt="${escapeHtml(plugin.name || 'Plugin icon')}">`
            : '<i class="fas fa-puzzle-piece" aria-hidden="true"></i>';

        const hostLabel = resolveHostLabel(plugin.url || '');
        card.innerHTML = `
            <div class="launchpad-plugin-media">${media}</div>
            <div class="launchpad-plugin-meta">
                <h3 class="launchpad-plugin-name">${escapeHtml(plugin.name || 'Untitled Plugin')}</h3>
                <p class="launchpad-plugin-visibility ${visibility}">${visibilityLabel}</p>
            </div>
            <p class="launchpad-plugin-host"><strong>Host:</strong> ${escapeHtml(hostLabel)}</p>
            <p class="launchpad-plugin-url">${escapeHtml(plugin.url || '')}</p>
        `;

        const mediaContainer = card.querySelector('.launchpad-plugin-media');
        if (mediaContainer) {
            mediaContainer.classList.add('clickable');
            mediaContainer.setAttribute('role', 'button');
            mediaContainer.setAttribute('tabindex', '0');
            mediaContainer.setAttribute('aria-label', `Preview ${plugin.name || 'plugin'}`);
            mediaContainer.title = 'Preview Plugin';
            mediaContainer.addEventListener('click', () => openLaunchpadBackendPreview(plugin));
            mediaContainer.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    openLaunchpadBackendPreview(plugin);
                }
            });
        }

        const cardImage = card.querySelector('.launchpad-plugin-media img');
        if (cardImage) {
            const fallbackQueue = getGoogleDriveImageFallbackUrls(plugin.image || plugin.imageUrl || '', plugin.image || '');
            const initialSrc = normalizeUrl(plugin.image || '');
            const retryQueue = fallbackQueue.filter((candidate) => candidate !== initialSrc);
            cardImage.addEventListener('error', () => {
                if (retryQueue.length) {
                    const nextUrl = retryQueue.shift();
                    console.warn('[Launchpad][Admin] Retrying plugin image with Google Drive fallback URL.', {
                        pluginId: plugin.id,
                        previousUrl: cardImage.currentSrc || plugin.image,
                        retryUrl: nextUrl
                    });
                    cardImage.src = nextUrl;
                    return;
                }

                console.error('[Launchpad][Admin] Plugin image failed to render.', {
                    pluginId: plugin.id,
                    imageUrl: plugin.image,
                    note: 'Possible causes: invalid URL format, Google Drive file not public, or host blocking image access.'
                });
                const mediaContainer = card.querySelector('.launchpad-plugin-media');
                if (mediaContainer) {
                    mediaContainer.innerHTML = '<i class="fas fa-puzzle-piece" aria-hidden="true"></i>';
                }
            });
        }

        const actions = document.createElement('div');
        actions.className = 'launchpad-plugin-actions';

        const previewButton = document.createElement('button');
        previewButton.type = 'button';
        previewButton.className = 'launchpad-plugin-preview-btn';
        previewButton.innerHTML = '<i class="fas fa-eye"></i> Preview';
        previewButton.addEventListener('click', () => openLaunchpadBackendPreview(plugin));
        actions.appendChild(previewButton);

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'launchpad-plugin-edit-btn';
        editButton.innerHTML = '<i class="fas fa-pen"></i> Edit';
        editButton.addEventListener('click', () => editLaunchpadPlugin(plugin));
        actions.appendChild(editButton);

        card.appendChild(actions);

        contentContainer.appendChild(card);
    });

    syncLaunchpadPreviewSelection();
}

function loadLaunchpadPlugins(searchTerm = '') {
    const contentContainer = document.getElementById('launchpad-container');
    if (!contentContainer) {
        console.warn('Launchpad container not found.');
        return;
    }

    currentSearchTerm = searchTerm || '';

    if (!launchpadPluginsUnsubscribe) {
        contentContainer.innerHTML = '<p class="text-center-message">Loading Launchpad plugins...</p>';
        const q = query(launchpadPluginsCollectionRef);
        launchpadPluginsUnsubscribe = onSnapshot(q, (snapshot) => {
            launchpadPluginsCache = [];
            snapshot.forEach((docSnapshot) => {
                launchpadPluginsCache.push({ id: docSnapshot.id, data: docSnapshot.data() });
            });

            launchpadPluginsCache.sort((a, b) => {
                const tsA = a.data.timestamp ? a.data.timestamp.toDate() : new Date(0);
                const tsB = b.data.timestamp ? b.data.timestamp.toDate() : new Date(0);
                return tsB - tsA;
            });

            launchpadPluginsCache = launchpadPluginsCache.map((item) => ({
                id: item.id,
                title: item.data.title || item.data.name || '',
                name: item.data.title || item.data.name || '',
                imageUrl: normalizeGoogleDriveImageUrl(item.data.imageUrl || item.data.image || ''),
                image: normalizeGoogleDriveImageUrl(item.data.imageUrl || item.data.image || ''),
                projectUrl: normalizeUrl(item.data.projectUrl || item.data.url || '') || (item.data.projectUrl || item.data.url || ''),
                url: normalizeUrl(item.data.projectUrl || item.data.url || '') || (item.data.projectUrl || item.data.url || ''),
                visibility: (item.data.visibility || '').toLowerCase() === 'public' ? 'public' : 'private',
                createdBy: item.data.createdBy || '',
                timestamp: item.data.timestamp || null
            }));

            launchpadPluginsCache.forEach((plugin) => {
                if (plugin.imageUrl) {
                    console.debug('[Launchpad][Admin][Render] Normalized plugin imageUrl:', {
                        pluginId: plugin.id,
                        imageUrl: plugin.imageUrl
                    });
                }
            });

            if (launchpadActivePreviewPluginId) {
                const activePlugin = launchpadPluginsCache.find((plugin) => plugin.id === launchpadActivePreviewPluginId);
                if (!activePlugin) {
                    closeLaunchpadBackendPreview();
                } else {
                    const activePluginUrl = normalizeUrl(activePlugin.projectUrl || activePlugin.url || '');
                    if (launchpadBackendViewerTitle) {
                        launchpadBackendViewerTitle.textContent = activePlugin.title || activePlugin.name || 'Untitled Plugin';
                    }
                    if (launchpadBackendViewerHost) {
                        launchpadBackendViewerHost.textContent = resolveHostLabel(activePluginUrl);
                    }
                    if (
                        activePluginUrl &&
                        launchpadSection?.classList.contains('plugin-preview-open') &&
                        launchpadBackendIframe &&
                        launchpadBackendIframe.src !== activePluginUrl
                    ) {
                        launchpadBackendIframe.src = activePluginUrl;
                    }
                }
            }

            renderLaunchpadPlugins(currentSearchTerm);
        }, (error) => {
            console.error('Error loading Launchpad plugins:', error);
            contentContainer.innerHTML = '<p class="text-center-message">Error loading Launchpad plugins.</p>';
        });
    } else {
        renderLaunchpadPlugins(currentSearchTerm);
    }
}


/**
 * Loads and displays content for a specific section from Firestore.
 * Includes search, sorting, and handles soft-deleted items for the archive.
 * @param {string} section - The content category (e.g., 'sermons', 'archive').
 * @param {string} searchTerm - The search term to filter by.
 * @param {string} [filterDate=null] - Optional date string (YYYY-MM-DD) to filter content by eventDate.
 */
function loadContentFirebase(section, searchTerm = '', filterDate = null) {
    if (section === 'launchpad') {
        loadLaunchpadPlugins(searchTerm);
        return;
    }

    const contentContainer = document.getElementById(`${section}-container`);
    if (!contentContainer) {
        console.warn(`Content container for section "${section}" not found.`);
        return;
    }

    // Clear previous content and show a temporary message
    contentContainer.innerHTML = '<p class="text-center-message">Loading content...</p>';
    if (section === 'archive') {
        document.getElementById('archive-empty-message').style.display = 'none';
    }

    let q;
    if (section === 'archive') {
        // Query for archived items (must have isArchived: true)
        q = query(
            contentCollectionRef,
            where("isArchived", "==", true)
        );
    } else {
        // For active sections, query ONLY by category.
        // We will filter by isArchived status client-side to include old docs.
        q = query(
            contentCollectionRef,
            where("category", "==", section)
        );
    }

    onSnapshot(q, (snapshot) => {
        let docs = [];
        snapshot.forEach(docSnapshot => {
            docs.push({ id: docSnapshot.id, data: docSnapshot.data() });
        });

        let relevantDocs = docs;

        // Apply client-side filter for active items if not in the archive section
        if (section !== 'archive') {
            relevantDocs = docs.filter(docItem => {
                const isArchivedStatus = docItem.data.isArchived;
                // Include items where isArchived is explicitly false OR where the field is undefined (old docs)
                return isArchivedStatus === false || isArchivedStatus === undefined;
            });
        }

        // Client-side sorting by timestamp (newest first)
        relevantDocs.sort((a, b) => {
            const tsA = a.data.timestamp ? a.data.timestamp.toDate() : new Date(0);
            const tsB = b.data.timestamp ? b.data.timestamp.toDate() : new Date(0);
            return tsB - tsA; // Descending order
        });

        // Client-side filter for search term
        let filteredDocs = relevantDocs;
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            filteredDocs = filteredDocs.filter(docItem => {
                const item = docItem.data;
                return (item.title && item.title.toLowerCase().includes(lowerSearchTerm)) ||
                       (item.description && item.description.toLowerCase().includes(lowerSearchTerm)) ||
                       (item.topic && item.topic.toLowerCase().includes(lowerSearchTerm)) ||
                       (item.by && item.by.toLowerCase().includes(lowerSearchTerm));
            });
        }

        // Client-side filter for event date
        if (filterDate) {
            filteredDocs = filteredDocs.filter(docItem => {
                const itemEventDate = docItem.data.eventDate; // YYYY-MM-DD string
                return itemEventDate === filterDate;
            });
        }


        contentContainer.innerHTML = ''; // Clear existing content

        if (filteredDocs.length === 0) {
            const message = section === 'archive' ?
                'No items found in the archive.' :
                `No content found in this category${searchTerm ? ` for "${searchTerm}"` : ''}${filterDate ? ` on ${filterDate}` : ''}.`;
            contentContainer.innerHTML = `<p class="text-center-message">${message}</p>`;
            if (section === 'archive') {
                document.getElementById('archive-empty-message').style.display = 'block';
            }
            return;
        }

        // Group content by event date for display (only for active sections, not archive and no specific date filter)
        const groupedContent = {};
        if (section !== 'archive' && !filterDate) {
            filteredDocs.forEach(docItem => {
                const eventDate = docItem.data.eventDate; // YYYY-MM-DD
                if (eventDate) {
                    if (!groupedContent[eventDate]) {
                        groupedContent[eventDate] = [];
                    }
                    groupedContent[eventDate].push(docItem);
                } else {
                    // Handle items without an eventDate, put them in a 'No Date' category
                    if (!groupedContent['No Date']) {
                        groupedContent['No Date'] = [];
                    }
                    groupedContent['No Date'].push(docItem);
                }
            });

            // Sort dates in descending order
            const sortedDates = Object.keys(groupedContent).sort((a, b) => {
                if (a === 'No Date') return 1; // 'No Date' comes last
                if (b === 'No Date') return -1;
                return new Date(b) - new Date(a);
            });

            sortedDates.forEach(date => {
                const dateHeading = document.createElement('h3');
                dateHeading.classList.add('date-group-heading');
                dateHeading.textContent = date === 'No Date' ? 'Content without a specific date' : new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                contentContainer.appendChild(dateHeading);

                groupedContent[date].forEach(docItem => {
                    renderContentItem(docItem, contentContainer, section);
                });
            });

        } else { // For archive or when a specific date is filtered
            filteredDocs.forEach(docItem => {
                renderContentItem(docItem, contentContainer, section);
            });
        }

    }, (error) => {
        console.error("Error fetching documents from Firestore: ", error);
        showToast('Error loading content. Please check your internet connection and Firebase rules.', 'error');
        contentContainer.innerHTML = '<p class="text-center-message">Error loading content. Please check your internet connection and Firebase rules.</p>';
    });
}

/**
 * Renders a single content item into the specified container.
 * Includes edit, delete, restore, and permanent delete buttons based on section.
 * @param {Object} docItem - The document object from Firestore ({id, data}).
 * @param {HTMLElement} container - The DOM element to append the content item to.
 * @param {string} currentSection - The currently active section ('sermons', 'archive', etc.).
 */
function renderContentItem(docItem, container, currentSection) {
    const item = docItem.data;
    const docId = docItem.id;

    const contentItemDiv = document.createElement('div');
    contentItemDiv.classList.add('content-item');

    let mediaContent = '';
    const youtubeId = item.url ? getYouTubeVideoId(item.url) : null;

    if (youtubeId) {
        mediaContent = `
            <div class="video-container">
                <iframe
                    src="https://www.youtube.com/embed/${youtubeId}?rel=0"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                    title="${item.title || 'YouTube video player'}"
                ></iframe>
            </div>
        `;
    } else if (item.url) {
        // Assume it's a direct file URL from Firebase Storage or another source
        // We can add logic here to differentiate video/audio/image if needed
        if (item.url.match(/\.(mp4|webm|ogg)$/i)) { // Basic video file check
            mediaContent = `<div class="video-container"><video controls src="${item.url}" style="width:100%; height:100%; border-radius:8px;"></video></div>`;
        } else if (item.url.match(/\.(mp3|wav|aac)$/i)) { // Basic audio file check
            mediaContent = `<audio controls src="${item.url}" style="width:100%; margin-top:15px;"></audio>`;
        } else if (item.url.match(/\.(png|jpg|jpeg|gif|webp)$/i)) { // Basic image file check
            mediaContent = `<img src="${item.url}" alt="${item.title}" style="width:100%; height:auto; border-radius:8px; margin-top:15px; object-fit: cover;">`;
        } else {
            mediaContent = `<a href="${item.url}" target="_blank" rel="noopener noreferrer" class="view-link">View Content Link</a>`;
        }
    }

    contentItemDiv.innerHTML = `
        <h3>${item.title}</h3>
        <p>${item.description || 'No description provided.'}</p>
        <div class="metadata">
            ${item.eventDate ? `<strong>Date:</strong> ${new Date(item.eventDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}<br>` : ''}
            ${item.eventTime ? `<strong>Time:</strong> ${item.eventTime}<br>` : ''}
            ${item.topic ? `<strong>Topic:</strong> ${item.topic}<br>` : ''}
            ${item.by ? `<strong>By:</strong> ${item.by}<br>` : ''}
        </div>
        ${mediaContent}
        <div class="content-item-actions">
            ${currentSection !== 'archive' ? `
                <button class="edit-content-btn" data-id="${docId}" data-section="${currentSection}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="delete-content-btn" data-id="${docId}" data-section="${currentSection}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            ` : `
                <button class="restore-content-btn" data-id="${docId}" data-section="${currentSection}">
                    <i class="fas fa-undo"></i> Restore
                </button>
                <button class="permanent-delete-btn" data-id="${docId}" data-section="${currentSection}">
                    <i class="fas fa-times-circle"></i> Delete Permanently
                </button>
            `}
        </div>
    `;
    container.appendChild(contentItemDiv);

    // Add event listeners for the action buttons
    if (currentSection !== 'archive') {
        // Edit Button Listener
        contentItemDiv.querySelector('.edit-content-btn').addEventListener('click', async (e) => {
            const idToEdit = e.currentTarget.dataset.id;
            editingDocId = idToEdit; // Set editing state
            modalTitle.textContent = 'Edit Content';
            saveContentBtn.textContent = 'Update Content';
            addMoreContentBtn.style.display = 'none'; // Hide "Add More" in edit mode
            contentEntriesContainer.innerHTML = ''; // Clear existing entries

            try {
                const docRef = doc(db, "content_items", idToEdit);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    addContentEntry(docSnap.data(), idToEdit); // Populate form with existing data
                    addContentModal.classList.add('active');
                } else {
                    showToast('Error: Document not found for editing.', 'error');
                }
            } catch (error) {
                console.error("Error fetching document for edit: ", error);
                showToast(`Error loading content for edit: ${error.message}`, 'error');
            }
        });

        // Soft Delete Button Listener
        contentItemDiv.querySelector('.delete-content-btn').addEventListener('click', async (e) => {
            const idToDelete = e.currentTarget.dataset.id;
            const confirmed = await showConfirmation("Are you sure you want to move this item to the archive?");
            if (confirmed) {
                try {
                    const docRef = doc(db, "content_items", idToDelete);
                    await updateDoc(docRef, { isArchived: true });
                    showToast("Content moved to archive successfully!", 'success');
                } catch (error) {
                    console.error("Error archiving content: ", error);
                    showToast(`Error archiving content: ${error.message}`, 'error');
                }
            }
        });
    } else { // Logic for Archive section buttons
        // Restore Button Listener
        contentItemDiv.querySelector('.restore-content-btn').addEventListener('click', async (e) => {
            const idToRestore = e.currentTarget.dataset.id;
            const confirmed = await showConfirmation("Are you sure you want to restore this item?");
            if (confirmed) {
                try {
                    const docRef = doc(db, "content_items", idToRestore);
                    await updateDoc(docRef, { isArchived: false });
                    showToast("Content restored successfully!", 'success');
                } catch (error) {
                    console.error("Error restoring content: ", error);
                    showToast(`Error restoring content: ${error.message}`, 'error');
                }
            }
        });

        // Permanent Delete Button Listener
        contentItemDiv.querySelector('.permanent-delete-btn').addEventListener('click', async (e) => {
            const idToPermanentlyDelete = e.currentTarget.dataset.id;
            const confirmed = await showConfirmation("Are you sure you want to PERMANENTLY delete this item? This action cannot be undone.");
            if (confirmed) {
                try {
                    const docRef = doc(db, "content_items", idToPermanentlyDelete);
                    const docSnap = await getDoc(docRef);
                    const itemData = docSnap.data();

                    // Delete associated file from Firebase Storage if it exists
                    if (itemData.url && itemData.url.startsWith('https://firebasestorage.googleapis.com/')) {
                        const fileRef = ref(storage, itemData.url); // Create a storage ref from the URL
                        try {
                            await deleteObject(fileRef);
                            console.log("Associated file deleted from storage.");
                        } catch (storageError) {
                            console.warn("Could not delete associated file from storage (might not exist or permissions issue): ", storageError);
                            // Continue with document deletion even if file deletion fails
                        }
                    }

                    await deleteDoc(docRef);
                    showToast("Content permanently deleted!", 'success');
                } catch (error) {
                    console.error("Error permanently deleting content: ", error);
                    showToast(`Error permanently deleting content: ${error.message}`, 'error');
                }
            }
        });
    }
}
