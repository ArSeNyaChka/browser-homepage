const searchlineInput = document.getElementById("search-line-input");
const suggestionsList = document.getElementById("suggestions-list");
const clearBtn = document.getElementById("clear-btn");
const searchEngineBtns = document.querySelectorAll(".search-engine-btn");

const SearchEngines = Object.freeze({
    GOOGLE: 'Google',
    DUCKDUCKGO: 'DuckDuckGo',
    YOUTUBE: 'YouTube'
});

// States
let suggestions = []; // массив подсказок
let DDGSuggestions = [];
let selectedSuggestionIndex = -1; // индекс выбранной подсказки
// let isNavigating = false; // флаг навигации клавишами
// let abortController = null; // для отмены предыдущего запроса
let debounceTimer = Date.now();
let lastTypeTime = Date.now();
let siteList = null;
let selectedEngine = null;


// Call onload
async function loadSiteList() {
    const localSiteList = localStorage.getItem('siteList');

    if (localSiteList === null) {  // Load standart siteList
        const response = await fetch('sites.json');
        siteList = await response.json();
        localStorage.setItem('siteList', JSON.stringify(siteList));
    } else {
        siteList = JSON.parse(localSiteList);
    }

    // Sorting
    siteList = Object.fromEntries(Object.entries(siteList).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)));
}


async function getSuggestions(searchInput) {
    if (searchInput.length === 0) { return []; }

    let suggestions = getSitesSuggestions(searchInput);
    for (let i = 0; i < suggestions.length; ++i) { suggestions[i] = {type: "site", content: suggestions[i]}; }

    if (Date.now() - debounceTimer > 2500) {
        debounceTimer = Date.now();
        DDGSuggestions = await getDDGSuggestions(searchInput);
        for (let i = 0; i < DDGSuggestions.length; ++i) { DDGSuggestions[i] = {type: "requst", content: DDGSuggestions[i].phrase}; }
    }

    if (selectedEngine !== null) { return DDGSuggestions.slice(0, 5); }
    return suggestions.concat(DDGSuggestions).slice(0, 5);
}


function getSitesSuggestions(searchInput) {
    return Object.keys(siteList).filter(key => key.toLowerCase().startsWith(searchInput.toLowerCase())).slice(0, 5);
}


async function getDDGSuggestions(searchInput) {
    const firstWord = searchInput.split(' ')[0];
    if (siteList[firstWord] !== undefined && ['google.com', 'youtube.com', 'duckduckgo.com'].includes(siteList[firstWord].url)) {
        searchInput = searchInput.slice(firstWord);
    }

    const res = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(searchInput)}`);
    const sugs = await res.json();
    // console.log("sugs:")
    // console.log(sugs);
    return sugs;
}


function search(request) {
    if (selectedEngine === null || selectedEngine === SearchEngines.GOOGLE) {
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(request)}`;
    } else if (selectedEngine === SearchEngines.YOUTUBE) {
        window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(request)}`;
    } else if (selectedEngine === SearchEngines.DUCKDUCKGO) {
        window.location.href = `https://duckduck.com/?q=${encodeURIComponent(request)}`;
    } else {
        alert(selectedEngine);
    }
}

/*
 * EventListeners
 */
searchlineInput.addEventListener('input', (event) => {
    async function renderSuggestionList(inTimeout = false) {
        if (inTimeout && Date.now() - lastTypeTime < 700) { return; }
        else if (inTimeout) { debounceTimer -= 3000; }

        const value = searchlineInput.value;
        suggestions = await getSuggestions(value);
        // console.log("suggestions:")
        // console.log(suggestions);

        if (!suggestions || suggestions.length === 0 || !value || value.length === 0) {
            suggestionsList.hidden = true;
            return;
        }
        
        let html = "";
        // const suggestionsListLenght = suggestions.length < 6 ? suggestions.length : 5;
        // for (let i = 0; i < suggestions.length; i++) {
        //     html += `<div class="suggestion">${suggestions[i]}<span class="suggestion-name">${siteList[suggestions[i]].name}</span></div>`;
        // }
        suggestions.forEach((suggestion) => {
            html += `<div class="suggestion">${suggestion.content}<span class="suggestion-name">${suggestion.type === "site" ? siteList[suggestion.content].name : ""}</span></div>`;
        });
        
        suggestionsList.hidden = false;
        suggestionsList.innerHTML = html;
    }

    lastTypeTime = Date.now();
    renderSuggestionList();
    setTimeout(renderSuggestionList, 800, true);
});

searchlineInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        
        const value = event.target.value.toLowerCase();
        const sugContent = suggestions[Math.max(selectedSuggestionIndex, 0)]?.content;
        const sugType = suggestions[Math.max(selectedSuggestionIndex, 0)]?.type;
        // const suggestionsList = getSitesSuggestions(value);
        
        if (
            !suggestions ||
            suggestions.length === 0 ||
            event.shiftKey ||
            selectedSuggestionIndex === -2 ||
            !sugContent.startsWith(value)
        ) {
            return search(value);
        }

        if (sugType === "site") {
            return window.location.href = 'https://' + siteList[sugContent].url;
        } else if (sugType === "requst") {
            return search(sugContent);
        }

        
        // const targetUrl = siteList[suggestions[Math.max(selectedSuggestionIndex, 0)]].url;

        // if (targetUrl !== null) {
        //     window.location.href = 'https://' + targetUrl;
        // }
    } else if (event.key === 'Tab' || event.key === 'ArrowDown') {
        event.preventDefault();
        selectedSuggestionIndex = (Math.max(selectedSuggestionIndex+1, 0)) % suggestions.length;

        suggestionsList.classList.remove('disabled-suggestions-list');
        suggestionsList.querySelectorAll('.suggestion').forEach((node) => { node.classList.remove('active-suggestion'); });
        suggestionsList.querySelectorAll('.suggestion')[selectedSuggestionIndex].classList.add('active-suggestion');
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectedSuggestionIndex = Math.abs((Math.max(selectedSuggestionIndex, 0)-1) % suggestions.length);

        suggestionsList.classList.remove('disabled-suggestions-list');
        suggestionsList.querySelectorAll('.suggestion').forEach((node) => { node.classList.remove('active-suggestion'); });
        suggestionsList.querySelectorAll('.suggestion')[selectedSuggestionIndex].classList.add('active-suggestion');
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        event.target.value = suggestions[Math.max(selectedSuggestionIndex, 0)].content;
    } else if (event.key === 'Escape') {
        event.preventDefault();

        selectedSuggestionIndex = -2;
        suggestionsList.classList.add('disabled-suggestions-list');
        suggestionsList.querySelectorAll('.suggestion').forEach((node) => { node.classList.remove('active-suggestion'); });
    }
});

// Always focused
searchlineInput.addEventListener('blur', () => { searchlineInput.focus(); }); 


searchEngineBtns.forEach((btn) => {btn.addEventListener('click', () => {
    if (btn.classList.contains('selected-search-engine-btn')) {
        btn.classList.remove('selected-search-engine-btn');
        selectedEngine = null;
        return;
    }

    selectedEngine = SearchEngines[btn.textContent.toUpperCase()];

    searchEngineBtns.forEach((b) => { b.classList.remove('selected-search-engine-btn'); });
    btn.classList.add('selected-search-engine-btn');
})});























// /**
//  * Рендеринг подсказок
//  */
// function renderSuggestions(suggestionsArray, searchQuery) {
//     suggestions = suggestionsArray;
//     selectedIndex = -1;
//     isNavigating = false;

//     if (!suggestionsArray || suggestionsArray.length === 0) {
//         suggestionsList.classList.remove('active');
//         return;
//     }

//     let html = `<div class="suggestions-count">${suggestionsArray.length} подсказок</div>`;

//     suggestionsArray.forEach((suggestion, index) => {
//         // Подсветка совпадения
//         const highlighted = highlightMatch(suggestion, searchQuery);
//         html += `
//             <div class="suggestion-item" data-index="${index}">
//                 <span class="icon">🔍</span>
//                 <span class="text">${highlighted}</span>
//             </div>
//         `;
//     });

//     suggestionsList.innerHTML = html;
//     suggestionsList.classList.add('active');

//     // Добавляем обработчики кликов
//     document.querySelectorAll('.suggestion-item').forEach(item => {
//         item.addEventListener('mousedown', function(e) {
//             e.preventDefault(); // предотвращаем потерю фокуса
//             const index = parseInt(this.dataset.index);
//             selectSuggestion(index);
//         });

//         item.addEventListener('mouseenter', function() {
//             const index = parseInt(this.dataset.index);
//             if (!isNavigating) {
//                 setActiveSuggestion(index);
//             }
//         });
//     });
// }

// /**
//  * Установка активной подсказки
//  */
// function setActiveSuggestion(index) {
//     selectedIndex = index;
//     document.querySelectorAll('.suggestion-item').forEach((item, i) => {
//         item.classList.toggle('active', i === index);
//     });

//     // Прокрутка к активному элементу
//     const activeItem = document.querySelector('.suggestion-item.active');
//     if (activeItem) {
//         activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
//     }
// }

// /**
//  * Выбор подсказки (по клику или Enter)
//  */
// function selectSuggestion(index) {
//     if (index >= 0 && index < suggestions.length) {
//         const value = suggestions[index];
//         input.value = value;
//         suggestionsList.classList.remove('active');
//         selectedIndex = -1;
//         input.focus();
        
//         // Здесь можно выполнить поиск
//         performSearch(value);
//     }
// }


loadSiteList();
