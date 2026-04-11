# Debug Session: pos-receipt-modal-missing

## Symptoms
- **Expected**: Receipt modal pops up automatically after every sale.
- **Actual**: Occasionally the POS returns to the menu immediately, skipping the receipt modal.
- **Errors**: No visible error messages or console errors reported by the user.
- **Reproduction**: Intermittent, no specific pattern (payment method, items, etc.) identified yet.
- **Timeline**: Has been happening for a while.

## Hypotheses
1. **Race Condition in State Updates**: The sale completion logic might be resetting the checkout state before the receipt modal has a chance to trigger or mount.
2. **Conditional Logic error**: A `showReceipt` flag or similar state might be incorrectly evaluated as `false` under specific circumstances.
3. **Async Transaction Interruption**: The async call to complete the sale might be resolving but the subsequent UI transition logic is being pre-empted or ignored.
4. **Modal Mounting Issues**: The modal component might be failing to mount due to a missing dependency or a timing issue with the POS state transition.

## Investigation Log
- [ ] Locate sale completion logic in POS (+ checkout flow).
- [ ] Identify where the receipt modal is triggered.
- [ ] Look for state resets (e.g. `resetCart`, `clearSale`) that happen concurrently with receipt display.
- [ ] Check if the transition back to "menu" is triggered by the same function that should show the receipt.
