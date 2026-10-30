import { describe, it, expect } from 'vitest';
import { configureStore, createAsyncThunk } from '@reduxjs/toolkit';
import uiReducer, { selectToast } from '@/features/ui/uiSlice';
import { failureToast } from './failureToast';

const makeStore = () =>
  configureStore({ reducer: { ui: uiReducer }, middleware: (getDefault) => getDefault().concat(failureToast) });
const failing = (type) =>
  createAsyncThunk(type, async () => {
    throw new Error('You can keep up to 5 circuits.');
  });

describe('failureToast', () => {
  it('shows the error of a failed dashboard action', async () => {
    const store = makeStore();
    await store.dispatch(failing('projects/create')());
    expect(selectToast(store.getState()).message).toBe('You can keep up to 5 circuits.');
  });

  it('shows the error of a failed gallery action', async () => {
    const store = makeStore();
    await store.dispatch(failing('gallery/remix')());
    expect(selectToast(store.getState()).message).toBe('You can keep up to 5 circuits.');
  });

  it('shows the error of a failed admin action, but not a failed admin login', async () => {
    const store = makeStore();
    await store.dispatch(failing('admin/setUserDisabled')());
    expect(selectToast(store.getState()).message).toBe('You can keep up to 5 circuits.');
    const other = makeStore();
    await other.dispatch(failing('admin/login')());
    expect(selectToast(other.getState()).message).toBe('');
  });

  it('leaves auth errors to the forms that show them', async () => {
    const store = makeStore();
    await store.dispatch(failing('auth/login')());
    expect(selectToast(store.getState()).message).toBe('');
  });
});
