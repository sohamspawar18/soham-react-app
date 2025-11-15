import React, { useState } from 'react'
import { CONTRACT_ABI, CONTRACT_ADDRESS, getFunctionsMeta, callRead, callWrite, coerceArg } from './functions'
import { decodeEventLog } from 'viem'

function toDisplay(val: any) {
  try {
    if (typeof val === 'bigint') return val.toString();
    return typeof val === 'string' ? val : JSON.stringify(val, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
  } catch {
    try { return String(val); } catch { return '<?>'; }
  }
}

const short = (a: string) => (a && a.length > 14 ? a.slice(0, 10) + '…' + a.slice(-8) : a);

function WriteSummary({ receipt }: { receipt: any }) {
  if (!receipt) return null;
  const status = receipt.status || 'confirmed';
  const block = (receipt.blockNumber && receipt.blockNumber.toString) ? receipt.blockNumber.toString() : String(receipt.blockNumber ?? '');
  const from = receipt.from || '';
  const to = receipt.to || '';
  const txHash = receipt.transactionHash || '';

  let summary = null as null | string;
  try {
    for (const log of (receipt.logs || [])) {
      try {
        const decoded: any = decodeEventLog({ abi: CONTRACT_ABI as any, data: log.data, topics: log.topics });
        if (decoded?.eventName === 'Transfer') {
          const a: any = decoded.args || {};
          const value = a.value != null ? String(a.value) : '';
          const frm = String(a.from ?? a._from ?? from);
          const t = String(a.to ?? a._to ?? to);
          summary = 'Transfer ' + value + ' from ' + short(frm) + ' to ' + short(t);
          break;
        }
        if (decoded?.eventName === 'Approval') {
          const a: any = decoded.args || {};
          const value = a.value != null ? String(a.value) : '';
          const owner = String(a.owner ?? a._owner ?? from);
          const spender = String(a.spender ?? a._spender ?? '');
          summary = 'Approval: ' + short(owner) + ' → ' + short(spender) + ' for ' + value;
          break;
        }
      } catch {}
    }
  } catch {}

  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, fontSize: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid', borderColor: status === 'success' ? '#a7f3d0' : '#fecaca', background: status === 'success' ? '#ecfdf5' : '#fef2f2', color: status === 'success' ? '#065f46' : '#991b1b' }}>{status}</span>
        {summary ? <span>{summary}</span> : (block ? <span>Block {block}</span> : null)}
      </div>
      <div style={{ marginTop: 4, color: '#374151' }}>Hash: <a href={'https://sepolia.etherscan.io/tx/' + txHash} target="_blank" rel="noreferrer">{short(txHash)}</a></div>
      <details style={{ marginTop: 6 }}>
        <summary>Details</summary>
        <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
          {from && <div>From: <a href={'https://sepolia.etherscan.io/address/' + from} target="_blank" rel="noreferrer">{short(from)}</a></div>}
          {to && <div>To: <a href={'https://sepolia.etherscan.io/address/' + to} target="_blank" rel="noreferrer">{short(to)}</a></div>}
        </div>
        <details style={{ marginTop: 6 }}><summary>Raw receipt</summary><pre style={{ fontSize: 12, background: '#f8f8f8', padding: 8 }}>{toDisplay(receipt)}</pre></details>
      </details>
    </div>
  );
}

export default function App() {
  const { reads, writes } = getFunctionsMeta();
  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h1>ShaniAI dApp — Demo: ERC20 Token</h1>
      <p>Chain: sepolia</p>
      <p>Address: {CONTRACT_ADDRESS || 'not set'}</p>

      <section style={{ marginTop: 16 }}>
        <h2>Read functions</h2>
        {reads.length === 0 && <p>No read functions</p>}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {reads.map((fn: any) => (
            <FnCard key={fn.name} fn={fn} kind="read" />
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Write functions</h2>
        {writes.length === 0 && <p>No write functions</p>}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {writes.map((fn: any) => (
            <FnCard key={fn.name} fn={fn} kind="write" />
          ))}
        </div>
      </section>

      <details style={{ marginTop: 24 }}>
        <summary>View ABI</summary>
        <pre style={{ fontSize: 12, background: '#f8f8f8', padding: 8 }}>{toDisplay(CONTRACT_ABI)}</pre>
      </details>
    </div>
  )
}

function FnCard({ fn, kind }: { fn: any, kind: 'read' | 'write' }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [out, setOut] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const onSubmit = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    setOut(null);
    try {
      const args = (fn.inputs || []).map((inp: any) => coerceArg(inp.type, values[inp.name] ?? ''));
      const res = kind === 'read' ? await callRead(fn.name, args) : await callWrite(fn.name, args);
      setOut({ kind, res });
    } catch (err: any) {
      setOut({ kind: 'error', res: err?.message || String(err) });
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={onSubmit} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 12 }}>
      <div style={{ fontWeight: 600 }}>{fn.name}</div>
      {(fn.inputs || []).map((inp: any) => (
        <div key={inp.name} style={{ marginTop: 8 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#374151' }}>{inp.name} <span style={{ color: '#6b7280' }}>({inp.type})</span></label>
          {inp.type === 'bool' ? (
            <input type="checkbox" checked={values[inp.name] === 'true'} onChange={(e) => setValues({ ...values, [inp.name]: e.target.checked ? 'true' : 'false' })} />
          ) : (
            <input value={values[inp.name] || ''} onChange={(e) => setValues({ ...values, [inp.name]: e.target.value })} placeholder={inp.type.endsWith(']') ? 'JSON, e.g. [1,2]' : inp.type} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 4, padding: '6px 8px' }} />
          )}
        </div>
      ))}
      <div style={{ marginTop: 10 }}><button disabled={busy} type="submit" style={{ background: '#065f46', color: 'white', padding: '6px 10px', borderRadius: 4 }}>{busy ? 'Working…' : kind === 'read' ? 'Call' : 'Send Tx'}</button></div>
      {out !== null && (
        out.kind === 'read' ? (
          <pre style={{ marginTop: 8, fontSize: 12, background: '#f8f8f8', padding: 8, whiteSpace: 'pre-wrap' }}>{toDisplay(out.res)}</pre>
        ) : out.kind === 'write' ? (
          <div style={{ marginTop: 8 }}><WriteSummary receipt={out.res} /></div>
        ) : (
          <div style={{ marginTop: 8, color: '#991b1b', fontSize: 12 }}>{String(out.res)}</div>
        )
      )}
    </form>
  );
}
