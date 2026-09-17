import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignaturePad } from './SignaturePad';

const pad = vi.hoisted(() => ({ empty: true, export: vi.fn(), trimmed: vi.fn(), transform: vi.fn() }));
vi.mock('react-signature-canvas', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef(function MockPad(
      props: {
        onBegin: () => void;
        onEnd: () => void;
        clearOnResize: boolean;
      },
      ref
    ) {
      React.useImperativeHandle(ref, () => ({
        isEmpty: () => pad.empty,
        getCanvas: () => ({
          width: 900,
          height: 360,
          getBoundingClientRect: () => ({ width: 300, height: 144 }),
          getContext: () => ({ setTransform: pad.transform }),
          toDataURL: pad.export,
        }),
        getTrimmedCanvas: pad.trimmed,
        clear: () => {
          pad.empty = true;
        },
      }));
      return (
        <button
          type="button"
          data-resize-clear={String(props.clearOnResize)}
          onClick={() => {
            pad.empty = false;
            props.onBegin();
            props.onEnd();
          }}
        >
          Draw stroke
        </button>
      );
    }),
  };
});
function Form() {
  const [value, setValue] = useState('');
  return (
    <>
      <SignaturePad value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}
describe('signature confirmation', () => {
  beforeEach(() => {
    pad.empty = true;
    pad.transform.mockReset();
    pad.export.mockReset().mockReturnValue('data:image/png;base64,signature');
    pad.trimmed.mockReset().mockImplementation(() => {
      throw new TypeError('trimCanvas is not a function');
    });
  });
  it('allows multiple strokes, commits only on confirm and bypasses the broken trimming dependency', () => {
    render(<Form />);
    expect(screen.getByRole('button', { name: 'Confirm Signature' })).toBeDisabled();
    fireEvent.click(screen.getByText('Draw stroke'));
    fireEvent.click(screen.getByText('Draw stroke'));
    expect(screen.getByTestId('value')).toBeEmptyDOMElement();
    expect(screen.getByText('Draw stroke')).toHaveAttribute('data-resize-clear', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Signature' }));
    expect(screen.getByAltText('Confirmed Digital Handwritten Signature')).toHaveAttribute(
      'src',
      'data:image/png;base64,signature'
    );
    expect(pad.trimmed).not.toHaveBeenCalled();
    expect(screen.getByTestId('value')).toHaveTextContent('data:image/png;base64,signature');
    fireEvent.click(screen.getByRole('button', { name: 'Clear & Redraw' }));
    expect(screen.getByTestId('value')).toBeEmptyDOMElement();
    expect(screen.getByText('Draw stroke')).toBeInTheDocument();
  });
  it('aligns mouse and touch coordinates with the fixed bitmap on narrow screens', () => {
    render(<Form />);
    fireEvent.mouseDown(screen.getByText('Draw stroke'));
    expect(pad.transform).toHaveBeenLastCalledWith(3, 0, 0, 2.5, 0, 0);
    fireEvent.touchStart(screen.getByText('Draw stroke'));
    expect(pad.transform).toHaveBeenCalledTimes(2);
  });
  it('reports capture failure and permits retry without losing the drawing', () => {
    render(<Form />);
    fireEvent.click(screen.getByText('Draw stroke'));
    pad.export.mockImplementationOnce(() => {
      throw new Error('capture failed');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Signature' }));
    expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
    expect(screen.getByTestId('value')).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Signature' }));
    expect(screen.getByAltText('Confirmed Digital Handwritten Signature')).toBeInTheDocument();
  });
});
