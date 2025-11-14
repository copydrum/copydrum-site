## Planned Changes

I will implement the following updates:

1. Update `src/pages/admin/page.tsx`
   - In `handleConfirmBankDeposit`, update both `payment_status` and `status` (e.g. set to `'payment_confirmed'` and `'completed'`) so the order row reflects the confirmation immediately.
   - After the mutation, keep using `loadOrders()`/`setSelectedOrder` to refresh the admin list.

2. Verify that downstream status labels already consume the updated `status` field. If additional mapping is needed for consistency, adjust `normalizeOrderStatus` accordingly.

