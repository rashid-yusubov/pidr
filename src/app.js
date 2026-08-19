import { elements, state } from "./context.js";
import { configureAuth, ensureUserDocument, handleAuthSubmit, handleGoogleAuth, handleLogout, loadUsersFromFirestore, openAuthDialog, subscribeToAuthState } from "./auth.js";
import {
  clearAllData,
  configureMovies,
  fillMovieFormFromLookup,
  handleEditMovieSubmit,
  handleMovieFormReset,
  handleMovieSubmit,
  loadMoviesFromCache,
  loadMoviesFromFirestore,
  openManualMovieDialog,
  openMovieDialog,
  setMovieDialogStage,
  startMoviesRealtime,
  resetMovieEditorForm,
  renderMovies,
  renderRatingFields
} from "./movies.js";
import {
  clearGenreSelection,
  configureFilters,
  getMovieSearchResultsCount,
  handleFilterSubmit,
  handleSortControlsChange,
  openFilterDialog,
  populateYearInputs,
  renderFilterSummary,
  renderGenreOptions,
  resetFilterState,
  syncFilterForm,
  syncSortControls,
  syncYearInputs,
  toggleSortDirection
} from "./filters.js";
import { configureProfile, handleLinkGoogleAccount, handleProfileAvatarFileChange, handleProfileSubmit, handleRemoveProfileAvatar, syncProfileAvatarPreviewFromFields, syncProfileForm } from "./profile.js";
import { buildRatingStars, configureRatings, handleRatingSubmit } from "./ratings.js";
import { configureTmdb, handleMovieLookup, handleMovieLookupInput, handleTmdbSettingsChange, loadTmdbSettingsFromFirestore, renderLookupRecentSearches, syncSettingsFields, syncTmdbProxyFieldState } from "./tmdb.js";
import { closeAdminDialogs, closeUserMenu, getCurrentUserLabel, getRoleLabel, getUserAvatarMarkup, getUserLabel, handleGlobalClick, isAdmin, openDialog, renderAuthButton, setAuthPasswordVisibility, setStatus, syncBodyModalState, toggleAuthPasswordVisibility, toggleUserMenu } from "./ui.js";
import { createEmptyState, escapeHtml, getTodayInputValue } from "./utils.js";

export function initApp() {
  configureFilters({ renderApp });
  configureMovies({ refreshAppData, openAuthDialog: handleOpenAuthDialog, openDialog });
  configureRatings({ refreshAppData, openAuthDialog: handleOpenAuthDialog });
  configureProfile({ ensureUserDocument, refreshAppData });
  configureTmdb({ fillMovieFormFromLookup });
  configureAuth({
    onSignedIn: async () => {
      if (!globalThis.__pidrBoot?.isInitialAuthEvent) {
        globalThis.__pidrPreloader?.show?.();
      }
      try {
        await refreshAppData();
        showLoggedInApp();
      } finally {
        if (!globalThis.__pidrBoot?.isInitialAuthEvent) {
          globalThis.__pidrPreloader?.hide?.();
        }
      }
    },
    onSignedOut: async () => {
      if (!globalThis.__pidrBoot?.isInitialAuthEvent) {
        globalThis.__pidrPreloader?.show?.();
      }
      try {
        closeAdminDialogs();
        handleMovieFormReset();
        resetMovieEditorForm();
        await refreshGuestData();
      } finally {
        if (!globalThis.__pidrBoot?.isInitialAuthEvent) {
          globalThis.__pidrPreloader?.hide?.();
        }
      }
    }
  });

  bindEvents();
  elements.movieDate.value = getTodayInputValue();
  elements.editMovieDate.value = getTodayInputValue();
  resetFilterState({ closeDialog: false, rerender: false });
  populateYearInputs();
  syncFilterForm();
  syncSortControls();
  syncSettingsFields();
  buildRatingStars();
  renderAuthButton();

  // Публичный каталог должен быть виден сразу, даже до резолва auth-состояния.
  void refreshGuestData();
  startMoviesRealtime();
  subscribeToAuthState();
}

async function refreshGuestData() {
  state.users = [];
  state.friends = [];
  try {
    await loadTmdbSettingsFromFirestore();
    await loadMoviesFromFirestore();
  } catch (error) {
    // Не затираем уже загруженный список, если публичное чтение временно недоступно.
    console.error("Не удалось загрузить публичный список фильмов.", error);
    if (!state.movies.length) {
      const cachedMovies = loadMoviesFromCache();
      state.movies = cachedMovies;
    }
  }
  renderApp();
}

async function refreshAppData() {
  await loadUsersFromFirestore();
  await loadMoviesFromFirestore();
  await loadTmdbSettingsFromFirestore();
  renderApp();
}

function bindEvents() {
  elements.authForm.addEventListener("submit", handleAuthSubmit);
  elements.authGoogleButton.addEventListener("click", handleGoogleAuth);
  elements.toggleAuthPassword.addEventListener("click", toggleAuthPasswordVisibility);
  elements.authTrigger.addEventListener("click", handleAuthButtonClick);
  elements.currentUserBadge.addEventListener("click", toggleUserMenu);
  elements.logoutButton.addEventListener("click", handleLogoutClick);
  elements.friendForm.addEventListener("submit", handleUserManagementSubmit);
  elements.movieForm.addEventListener("submit", handleMovieSubmit);
  elements.resetMovieFormButton.addEventListener("click", handleMovieFormReset);
  elements.editMovieForm.addEventListener("submit", handleEditMovieSubmit);
  elements.ratingForm.addEventListener("submit", handleRatingSubmit);
  elements.searchInput.addEventListener("input", renderMovies);
  elements.sortSelect.addEventListener("change", handleSortControlsChange);
  elements.sortDirection.addEventListener("click", toggleSortDirection);
  elements.clearAll.addEventListener("click", clearAllData);
  elements.openAddMovie.addEventListener("click", () => {
    if (state.currentUser) {
      openMovieDialog();
      renderLookupRecentSearches();
    }
  });
  elements.openSettings.addEventListener("click", () => {
    if (!state.currentUser) {
      return;
    }
    closeUserMenu();
    openSettingsDialog("account");
  });
  elements.settingsTabButtons.forEach((button) => {
    button.addEventListener("click", () => openSettingsSection(button.dataset.settingsTab || "account"));
  });
  elements.profileForm.addEventListener("submit", handleProfileSubmit);
  elements.profileAvatarUrl.addEventListener("input", syncProfileAvatarPreviewFromFields);
  elements.profileAvatarFile.addEventListener("change", handleProfileAvatarFileChange);
  elements.profileFocusButton.addEventListener("click", () => {
    elements.profileDisplayName.focus();
    elements.profileDisplayName.select();
  });
  elements.profileEditName.addEventListener("click", () => {
    elements.profileDisplayName.focus();
    elements.profileDisplayName.select();
  });
  elements.profileEditEmail.addEventListener("click", () => {
    if (!elements.profileEmail.disabled) {
      elements.profileEmail.focus();
      elements.profileEmail.select();
    }
  });
  elements.linkGoogleButton.addEventListener("click", handleLinkGoogleAccount);
  elements.removeProfileAvatar.addEventListener("click", handleRemoveProfileAvatar);
  elements.openFilter.addEventListener("click", () => openFilterDialog(openDialog));
  elements.openManualMovieForm.addEventListener("click", () => {
    elements.settingsDialog.close();
    openManualMovieDialog();
  });
  elements.movieFormBack.addEventListener("click", () => {
    setMovieDialogStage("search");
    renderLookupRecentSearches();
    requestAnimationFrame(() => elements.movieLookupQuery.focus());
  });
  elements.movieLookupQuery.addEventListener("input", handleMovieLookupInput);
  elements.movieLookupQuery.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleMovieLookup();
    }
  });
  elements.movieLookupQuery.addEventListener("click", (event) => event.stopPropagation());
  elements.movieLookupQuery.addEventListener("pointerdown", (event) => event.stopPropagation());
  elements.tmdbLanguage.addEventListener("change", handleTmdbSettingsChange);
  elements.tmdbPosterSize.addEventListener("change", handleTmdbSettingsChange);
  elements.tmdbAutoProxy.addEventListener("change", handleTmdbSettingsChange);
  elements.tmdbUseProxy.addEventListener("change", handleTmdbSettingsChange);
  elements.tmdbProxyHost.addEventListener("input", handleTmdbSettingsChange);
  elements.closeMovieDialog.addEventListener("click", () => elements.movieDialog.close());
  elements.closeEditMovieDialog.addEventListener("click", () => elements.editMovieDialog.close());
  elements.cancelEditMovie.addEventListener("click", () => elements.editMovieDialog.close());
  elements.closeSettingsDialog.addEventListener("click", () => elements.settingsDialog.close());
  elements.closeRatingDialog.addEventListener("click", () => elements.ratingDialog.close());
  elements.closeDetailsDialog.addEventListener("click", () => elements.detailsDialog.close());
  elements.closeFilterDialog.addEventListener("click", () => elements.filterDialog.close());
  elements.filterForm.addEventListener("submit", handleFilterSubmit);
  elements.resetFilter.addEventListener("click", resetFilterState);
  elements.clearGenres.addEventListener("click", clearGenreSelection);
  elements.filterYearFrom.addEventListener("input", () => syncYearInputs("from"));
  elements.filterYearTo.addEventListener("input", () => syncYearInputs("to"));

  [
    elements.authDialog,
    elements.movieDialog,
    elements.editMovieDialog,
    elements.settingsDialog,
    elements.ratingDialog,
    elements.detailsDialog,
    elements.filterDialog
  ].forEach((dialog) => {
    dialog.addEventListener("close", syncBodyModalState);
    dialog.addEventListener("cancel", syncBodyModalState);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
  });

  document.addEventListener("click", handleGlobalClick);
}

function handleAuthButtonClick() {
  handleOpenAuthDialog();
}

function handleOpenAuthDialog() {
  openAuthDialog(openDialog);
}

async function handleLogoutClick() {
  closeUserMenu();
  await handleLogout();
}

function showLoggedInApp() {
  if (elements.authDialog.open) {
    elements.authDialog.close();
  }
  elements.authPassword.value = "";
  setAuthPasswordVisibility(false);
  syncProfileForm();
  setStatus("Авторизация выполнена.", "success", "auth");
  renderAuthButton();
  syncBodyModalState();
}

function openSettingsDialog(section = "account") {
  syncProfileForm();
  syncSettingsFields();
  openSettingsSection(section);
  openDialog(elements.settingsDialog);
}

function openSettingsSection(section) {
  const normalizedSection = !isAdmin() && section !== "account" ? "account" : section;
  const allowFilmsSection = state.currentUser && section === "films";
  const normalizedSectionSafe = allowFilmsSection ? "films" : normalizedSection;

  elements.settingsTabButtons.forEach((button) => {
    const isActive = button.dataset.settingsTab === normalizedSectionSafe;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  elements.settingsPanels.forEach((panel) => {
    const isActive = panel.dataset.settingsPanel === normalizedSectionSafe;
    panel.hidden = !isActive;
    panel.classList.toggle("settings-panel-active", isActive);
  });

  elements.settingsContent.scrollTop = 0;
  syncTmdbProxyFieldState();
}

function renderApp() {
  updateRoleUi();
  renderUsersList();
  renderRatingFields(elements.ratingsFields);
  renderRatingFields(elements.editRatingsFields);
  populateYearInputs();
  renderGenreOptions();
  renderMovies();
  syncSortControls();
  renderFilterSummary(getMovieSearchResultsCount);
  syncSettingsFields();
  syncProfileForm();
}

function updateRoleUi() {
  elements.currentUserBadge.hidden = !state.currentUser;
  elements.currentUserBadge.innerHTML = state.currentUser
    ? `${getUserAvatarMarkup(state.currentUser, "user-avatar-sm")}<span class="user-badge-name">${escapeHtml(getCurrentUserLabel())}</span>`
    : "";
  elements.openAddMovie.hidden = !state.currentUser;
  elements.openSettings.hidden = !state.currentUser;
  elements.clearAll.hidden = !isAdmin();
  elements.settingsTabUsers.hidden = !isAdmin();
  elements.settingsTabTmdb.hidden = !isAdmin();
  elements.settingsTabFilms.hidden = !state.currentUser;
}

function renderUsersList() {
  elements.friendsList.innerHTML = "";

  if (!state.currentUser) {
    elements.friendsList.append(createEmptyState("Требуется вход", "Список пользователей доступен после авторизации."));
    return;
  }

  if (!state.users.length) {
    elements.friendsList.append(createEmptyState("Пользователей пока нет", "После входа пользователи будут появляться здесь автоматически."));
    return;
  }

  state.users.forEach((user) => {
    const chip = document.createElement("div");
    chip.className = "friend-chip";
    chip.innerHTML = `
      <span class="user-inline">${getUserAvatarMarkup(user, "user-avatar-xs")}<span>${escapeHtml(getUserLabel(user))}</span></span>
      <strong>${escapeHtml(getRoleLabel(user.roleView))}</strong>
    `;
    elements.friendsList.append(chip);
  });
}

function handleUserManagementSubmit(event) {
  event.preventDefault();
  setStatus("Создание и удаление аккаунтов из интерфейса требует Firebase Admin SDK или Cloud Functions. Пока пользователей нужно добавлять в Firebase Authentication.", "info", "users");
}
