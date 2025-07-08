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

// Initialize Firebase app, Firestore, and Storage instances
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const contentCollectionRef = collection(db, "content_items");

// --- Global Variables and DOM Elements ---
let activeSection = 'home';
let currentSearchTerm = '';
let editingDocId = null; // Stores the ID of the document being edited

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
                loadContentFirebase(activeSection, currentSearchTerm);
            }
        });
    });

    // --- Search Functionality ---
    searchInput.addEventListener('input', () => {
        currentSearchTerm = searchInput.value.trim();
        if (activeSection !== 'home') {
            loadContentFirebase(activeSection, currentSearchTerm);
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
            <option value="announcement">Announcement</option>
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


/**
 * Loads and displays content for a specific section from Firestore.
 * Includes search, sorting, and handles soft-deleted items for the archive.
 * @param {string} section - The content category (e.g., 'sermons', 'archive').
 * @param {string} searchTerm - The search term to filter by.
 * @param {string} [filterDate=null] - Optional date string (YYYY-MM-DD) to filter content by eventDate.
 */
function loadContentFirebase(section, searchTerm = '', filterDate = null) {
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