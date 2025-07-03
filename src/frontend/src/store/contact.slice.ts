import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import contactService, { Contact, QueryParams } from '../services/contact.service';

interface ContactState {
  contacts: Contact[];
  currentContact: Contact | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  selectedContactIds: string[];
}

const initialState: ContactState = {
  contacts: [],
  currentContact: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  },
  selectedContactIds: []
};

// 获取联系人列表
export const fetchContacts = createAsyncThunk(
  'contacts/fetchContacts',
  async (params: QueryParams = {}, { rejectWithValue }) => {
    try {
      const response = await contactService.getContacts(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '获取联系人列表失败');
    }
  }
);

// 获取单个联系人详情
export const fetchContact = createAsyncThunk(
  'contacts/fetchContact',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await contactService.getContact(id);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '获取联系人详情失败');
    }
  }
);

// 创建联系人
export const createContact = createAsyncThunk(
  'contacts/createContact',
  async (contactData: Partial<Contact>, { rejectWithValue }) => {
    try {
      const response = await contactService.createContact(contactData);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '创建联系人失败');
    }
  }
);

// 更新联系人
export const updateContact = createAsyncThunk(
  'contacts/updateContact',
  async ({ id, contactData }: { id: string; contactData: Partial<Contact> }, { rejectWithValue }) => {
    try {
      const response = await contactService.updateContact(id, contactData);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '更新联系人失败');
    }
  }
);

// 删除联系人
export const deleteContact = createAsyncThunk(
  'contacts/deleteContact',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await contactService.deleteContact(id);
      return { response, id };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '删除联系人失败');
    }
  }
);

// 批量删除联系人
export const batchDeleteContacts = createAsyncThunk(
  'contacts/batchDeleteContacts',
  async (ids: string[], { rejectWithValue }) => {
    try {
      const response = await contactService.batchDeleteContacts(ids);
      return { response, ids };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '批量删除联系人失败');
    }
  }
);

// 批量应用标签
export const batchApplyTags = createAsyncThunk(
  'contacts/batchApplyTags',
  async (data: { contactIds: string[]; tagIds: string[]; action: 'add' | 'remove' }, { rejectWithValue, dispatch }) => {
    try {
      const response = await contactService.batchApplyTags(data);
      // 更新联系人列表
      dispatch(fetchContacts({}));
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '批量应用标签失败');
    }
  }
);

const contactSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setSelectedContactIds: (state, action: PayloadAction<string[]>) => {
      state.selectedContactIds = action.payload;
    },
    clearCurrentContact: (state) => {
      state.currentContact = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // 获取联系人列表
      .addCase(fetchContacts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchContacts.fulfilled, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.contacts = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchContacts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // 获取单个联系人
      .addCase(fetchContact.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchContact.fulfilled, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.currentContact = action.payload.data;
      })
      .addCase(fetchContact.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // 创建联系人
      .addCase(createContact.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createContact.fulfilled, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        const newContact = action.payload.data || action.payload;
        if (newContact && newContact.id) {
          state.contacts.unshift(newContact);
          state.pagination.total += 1;
        }
      })
      .addCase(createContact.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // 更新联系人
      .addCase(updateContact.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateContact.fulfilled, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        if (state.currentContact && (state.currentContact.id === (action.payload.data?.id || action.payload.id))) {
          state.currentContact = action.payload.data || action.payload;
        }
        state.contacts = state.contacts.map((contact) =>
          contact.id === (action.payload.data?.id || action.payload.id) ? (action.payload.data || action.payload) : contact
        );
      })
      .addCase(updateContact.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // 删除联系人
      .addCase(deleteContact.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteContact.fulfilled, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        state.contacts = state.contacts.filter((contact) => contact.id !== action.payload.id);
        if (state.currentContact && state.currentContact.id === action.payload.id) {
          state.currentContact = null;
        }
      })
      .addCase(deleteContact.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // 批量删除联系人
      .addCase(batchDeleteContacts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(batchDeleteContacts.fulfilled, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        const deletedIds = action.payload.ids;
        state.contacts = state.contacts.filter((contact) => !deletedIds.includes(contact.id));
        state.selectedContactIds = state.selectedContactIds.filter((id) => !deletedIds.includes(id));
      })
      .addCase(batchDeleteContacts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // 批量应用标签
      .addCase(batchApplyTags.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(batchApplyTags.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(batchApplyTags.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  }
});

export const { clearError, setSelectedContactIds, clearCurrentContact } = contactSlice.actions;
export default contactSlice.reducer; 