// src/components/ribbon/tests/mini-crypto-widget.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';

import MiniCryptoWidget from '../mini-crypto-widget';

describe('MiniCryptoWidget', () => {
  it('renders five crypto assets from the whitelist', () => {
    render(<MiniCryptoWidget />);

    const list = screen.getByTestId('mini-crypto-widget');
    const items = (list as HTMLElement).querySelectorAll('li');
    expect(items.length).toBe(5);
  });
});
