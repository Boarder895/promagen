// frontend/src/components/exchanges/__tests__/exchange-clock.test.tsx
import * as React from 'react';
import { render, screen, act } from '@testing-library/react';

import { ExchangeClock } from '../time/exchange-clock';

// Mock the clock utility
jest.mock('@/lib/clock', () => ({
  formatClockInTZ: jest.fn(() => '14:23:45'),
}));

describe('ExchangeClock', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders initial time', () => {
    render(<ExchangeClock tz="Asia/Tokyo" />);

    expect(screen.getByText('14:23:45')).toBeInTheDocument();
  });

  it('renders with default aria-label', () => {
    render(<ExchangeClock tz="Asia/Tokyo" />);

    expect(screen.getByLabelText('Local time')).toBeInTheDocument();
  });

  it('renders with custom aria-label', () => {
    render(<ExchangeClock tz="Asia/Tokyo" ariaLabel="Tokyo time" />);

    expect(screen.getByLabelText('Tokyo time')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<ExchangeClock tz="Asia/Tokyo" className="custom-class" />);

    const timeElement = screen.getByLabelText('Local time');
    expect(timeElement).toHaveClass('custom-class');
  });

  it('renders time element with datetime attribute', () => {
    render(<ExchangeClock tz="Asia/Tokyo" />);

    const timeElement = screen.getByLabelText('Local time');
    expect(timeElement.tagName).toBe('TIME');
    expect(timeElement).toHaveAttribute('datetime');
  });

  it('has aria-live="off" to prevent screen reader spam', () => {
    render(<ExchangeClock tz="Asia/Tokyo" />);

    const timeElement = screen.getByLabelText('Local time');
    expect(timeElement).toHaveAttribute('aria-live', 'off');
  });

  it('updates time after interval', () => {
    const mockFormatClock = jest.requireMock('@/lib/clock').formatClockInTZ;

    render(<ExchangeClock tz="Europe/London" />);

    expect(screen.getByText('14:23:45')).toBeInTheDocument();

    // Change the mock return value
    mockFormatClock.mockReturnValue('14:23:46');

    // Advance timer by 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('14:23:46')).toBeInTheDocument();
  });

  it('cleans up interval on unmount', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = render(<ExchangeClock tz="Asia/Tokyo" />);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });

  it('resets interval when timezone changes', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    const { rerender } = render(<ExchangeClock tz="Asia/Tokyo" />);

    const initialCallCount = setIntervalSpy.mock.calls.length;

    rerender(<ExchangeClock tz="Europe/London" />);

    // Should have cleared the old interval and set a new one
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(setIntervalSpy.mock.calls.length).toBeGreaterThan(initialCallCount);

    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });
});
