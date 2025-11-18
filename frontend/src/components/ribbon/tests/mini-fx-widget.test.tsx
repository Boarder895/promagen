// src/components/ribbon/tests/mini-fx-widget.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';

import MiniFxWidget from '../mini-fx-widget';

describe('MiniFxWidget', () => {
  it('renders exactly five FX pairs from the free selection', () => {
    render(<MiniFxWidget />);

    const list = screen.getByTestId('mini-fx-widget');
    const items = (list as HTMLElement).querySelectorAll('li');
    expect(items.length).toBe(5);
  });
});
