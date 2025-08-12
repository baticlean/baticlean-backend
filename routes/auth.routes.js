// src/redux/authSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const API_URL = import.meta.env.VITE_API_URL;

// ✅ LA CORRECTION EST ICI
const getUserFromToken = (token) => {
    if (!token) return null;
    try {
        const decodedUser = jwtDecode(token);
        // On s'assure que le tableau 'warnings' existe toujours, même sur un ancien token.
        // S'il n'existe pas, on l'initialise comme un tableau vide.
        if (!decodedUser.warnings) {
            decodedUser.warnings = [];
        }
        return decodedUser;
    } catch (error) {
        localStorage.removeItem('authToken');
        return null;
    }
};

export const loginUser = createAsyncThunk('auth/login', async (userData, { rejectWithValue }) => {
    try {
        const response = await axios.post(`${API_URL}/api/auth/login`, userData);
        return response.data;
    } catch (error) {
        if (error.response) {
            const errorPayload = { 
                message: error.response.data.message || 'Erreur de connexion', 
                status: error.response.status,
                authToken: error.response.data.authToken 
            };
            return rejectWithValue(errorPayload);
        }
        return rejectWithValue({ message: 'Erreur réseau ou serveur indisponible.' });
    }
});

export const registerUser = createAsyncThunk('auth/register', async (userData, { rejectWithValue }) => {
    try {
        const response = await axios.post(`${API_URL}/api/auth/register`, userData);
        return response.data;
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || "Erreur d'inscription");
    }
});

export const clearWarning = createAsyncThunk(
    'auth/clearWarning',
    async (warningId, { getState, rejectWithValue }) => {
        try {
            const { token } = getState().auth;
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const response = await axios.patch(`${API_URL}/api/auth/warnings/${warningId}/clear`, null, config);
            return response.data.user; 
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Erreur lors de la suppression de l\'avertissement');
        }
    }
);


const initialToken = localStorage.getItem('authToken') || null;

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        user: getUserFromToken(initialToken),
        token: initialToken,
        loading: false,
        error: null,
        justReactivated: false,
        isNewUser: false,
    },
    reducers: {
        logout: (state) => {
            localStorage.removeItem('authToken');
            state.user = null;
            state.token = null;
            state.justReactivated = false;
            state.isNewUser = false;
            state.error = null;
        },
        updateUserFromSocket: (state, action) => {
            if (state.user && action.payload.user && action.payload.user._id === state.user._id) {
                const updatedUserData = action.payload.user;
                state.user = {
                    ...state.user,
                    ...updatedUserData,
                    warnings: updatedUserData.warnings || state.user.warnings || []
                };
                if (action.payload.newToken) {
                    state.token = action.payload.newToken;
                    localStorage.setItem('authToken', action.payload.newToken);
                }
            }
        },
        setJustReactivated: (state, action) => {
            state.justReactivated = action.payload;
        },
        setToken: (state, action) => {
            state.token = action.payload;
            state.user = getUserFromToken(action.payload);
        },
        addWarningFromSocket: (state, action) => {
            if (state.user) {
                if (!state.user.warnings) {
                    state.user.warnings = [];
                }
                state.user.warnings.unshift(action.payload);
            }
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(loginUser.pending, (state) => { 
                state.loading = true;
                state.error = null; 
            })
            .addCase(registerUser.pending, (state) => { 
                state.loading = true;
                state.error = null; 
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                const { authToken } = action.payload;
                localStorage.setItem('authToken', authToken);
                state.loading = false;
                state.token = authToken;
                state.user = getUserFromToken(authToken);
                state.isNewUser = false;
            })
            .addCase(registerUser.fulfilled, (state, action) => {
                const { authToken, isNewUser } = action.payload;
                localStorage.setItem('authToken', authToken);
                state.loading = false;
                state.token = authToken;
                state.user = getUserFromToken(authToken);
                state.isNewUser = isNewUser;
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload.message;
                if (action.payload.authToken) {
                    state.token = action.payload.authToken;
                    state.user = getUserFromToken(action.payload.authToken);
                }
            })
            .addCase(registerUser.rejected, (state, action) => { 
                state.loading = false; 
                state.error = action.payload; 
            })
            .addCase(clearWarning.fulfilled, (state, action) => {
                state.user = action.payload;
            });
    },
});

export const { logout, updateUserFromSocket, setJustReactivated, setToken, addWarningFromSocket } = authSlice.actions;
export default authSlice.reducer;
