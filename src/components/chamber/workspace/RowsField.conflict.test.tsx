import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import RowsField from './RowsField';
import { applyExtraction, applyFieldAction, transcriptExtraction, type IntakeState } from '@/data/provenance';
import { EMPTY_CHAMBER_DATA } from '@/data/chamberTypes';

it('lets the prospect choose a proposed table, retaining the original until that action', async () => {
  const original = [{ name: 'Gold', rate_ee: 100 }, { name: 'Silver', rate_ee: 50 }];
  const prior = applyExtraction({ data: EMPTY_CHAMBER_DATA, provenance: {} }, { medical_plans: original }, { source: { kind: 'document', document_id: 'd1', document_name: 'Plans.pdf' } });
  let state: IntakeState = applyExtraction(prior, { medical_plans: [{ name: 'Gold', rate_ee: 120 }] }, transcriptExtraction({ id: 'm1', text: 'Gold is 120' }, { corrected_fields: ['medical_plans'] }));
  const onAction = vi.fn((action) => { state = applyFieldAction(state, action); });
  const { rerender } = render(<RowsField field="medical_plans" rows={state.data.medical_plans} provenance={state.provenance.medical_plans} onAction={onAction} />);
  expect(state.data.medical_plans).toEqual(original);
  expect(screen.getByRole('group', { name: 'Resolve Current medical plans' })).toHaveTextContent('Plans.pdf');
  expect(screen.getByRole('list', { name: 'Current medical plans, version 2' })).toHaveTextContent('120');
  expect(screen.getByRole('list', { name: 'Current medical plans, version 2' })).toHaveTextContent('Silver');
  await userEvent.click(screen.getByRole('button', { name: 'Use version 2 for Current medical plans' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'resolve', field: 'medical_plans', candidate: 1 });
  expect(state.data.medical_plans).toEqual([{ name: 'Gold', rate_ee: 120 }, original[1]]);
  expect(state.provenance.medical_plans?.status).toBe('confirmed');
  expect(state.provenance.medical_plans?.also_heard?.[0].value).toEqual(original);
  rerender(<RowsField field="medical_plans" rows={state.data.medical_plans} provenance={state.provenance.medical_plans} onAction={onAction} />);
  expect(screen.queryByRole('group', { name: 'Resolve Current medical plans' })).not.toBeInTheDocument();
});
