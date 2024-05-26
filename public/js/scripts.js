function changeLanguage(language) {
    fetch(`public/locales/${language}.json`)
        .then(response => response.json())
        .then(data => {
            const titleElement = document.getElementById('title');
            const descriptionElement = document.getElementById('description');
            const uploadButtonElement = document.getElementById('upload-button');
            const fileUploadTextElement = document.querySelector('.file-upload-text');
            const serifFontLabelElement = document.getElementById('fontStyleSerifLabel');
            const sansSerifFontLabelElement = document.getElementById('fontStyleSansSerifLabel');
            const instruction1Element = document.getElementById('instruction1');
            const instruction2Element = document.getElementById('instruction2');
            const instruction3Element = document.getElementById('instruction3');
            const footerElement = document.getElementById('footer');
            const selectedLanguageElement = document.getElementById('selected-language');

            if (titleElement) titleElement.textContent = data.title;
            if (descriptionElement) descriptionElement.textContent = data.description;
            if (uploadButtonElement) uploadButtonElement.textContent = data.upload_button;
            if (fileUploadTextElement) fileUploadTextElement.textContent = data.choose_file;
            if (serifFontLabelElement) serifFontLabelElement.textContent = data.serif_font;
            if (sansSerifFontLabelElement) sansSerifFontLabelElement.textContent = data.sans_serif_font;
            if (instruction1Element) instruction1Element.textContent = data.instructions.p1;
            if (instruction2Element) instruction2Element.textContent = data.instructions.p2;
            if (instruction3Element) instruction3Element.textContent = data.instructions.p3;
            if (footerElement) footerElement.innerHTML = data.footer;
            if (selectedLanguageElement) selectedLanguageElement.value = language;
        });
}

function confirmNavigate() {
    return confirm('Returning to the homepage will require you to re-upload your file. Continue?');
}

function validateForm() {
    const fileInput = document.getElementById('fileUpload');
    const fontStyleSerif = document.getElementById('fontStyleSerif');
    const fontStyleSansSerif = document.getElementById('fontStyleSansSerif');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please choose a file.');
        return false;
    }
    
    if (file.type !== 'text/plain') {
        alert('Invalid file type. Only .txt files are allowed.');
        return false;
    }
    
    if (file.size > 1048576) { // 1MB
        alert('File size exceeds limit. Maximum allowed size is 1MB.');
        return false;
    }
    
    if (!fontStyleSerif.checked && !fontStyleSansSerif.checked) {
        alert('Please choose a font style.');
        return false;
    }
    
    return true;
}

document.addEventListener('DOMContentLoaded', function() {
    const fileUpload = document.getElementById('fileUpload');
    const fileUploadText = document.querySelector('.file-upload-text');
    const languageSelect = document.getElementById('language-select');
    const uploadForm = document.querySelector('.upload-form');

    const bodyElement = document.body;
    const initialLanguage = bodyElement.getAttribute('data-language');

    if (initialLanguage) {
        changeLanguage(initialLanguage);
    }

    if (fileUpload) {
        fileUpload.addEventListener('change', function() {
            if (fileUpload.files.length > 0) {
                fileUploadText.textContent = fileUpload.files[0].name;
            } else {
                fileUploadText.textContent = 'Choose a file...';
            }
        });
    }

    if (languageSelect) {
        languageSelect.addEventListener('change', function() {
            changeLanguage(this.value);
        });
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', function(event) {
            const selectedLanguageElement = document.getElementById('selected-language');
            console.log(`Selected language before submit: ${selectedLanguageElement.value}`); // Debug
            if (!validateForm()) {
                event.preventDefault();
            }
        });
    }

    // 为生成页面的按钮绑定事件监听器
    const saveAsPdfButton = document.getElementById('save-as-pdf');
    const generateMarkdownButton = document.getElementById('generate-markdown');
    const generateScreenshotButton = document.getElementById('generate-screenshot');

    if (saveAsPdfButton) {
        saveAsPdfButton.addEventListener('click', function() {
            window.location.href = '/download-pdf';
        });
    }

    if (generateMarkdownButton) {
        generateMarkdownButton.addEventListener('click', function() {
            window.location.href = '/download-markdown';
        });
    }

    if (generateScreenshotButton) {
        generateScreenshotButton.addEventListener('click', function() {
            window.location.href = '/download-screenshot';
        });
    }

    const bknLink = document.getElementById('bkn-link');
    if (bknLink) {
        bknLink.addEventListener('click', function(event) {
            if (!confirmNavigate()) {
                event.preventDefault();
            }
        });
    }

    if (!initialLanguage) {
        changeLanguage('en');
    }
});