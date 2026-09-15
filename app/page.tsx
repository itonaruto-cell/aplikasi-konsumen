'use client';
import { useState, useEffect, FormEvent } from 'react';

// Menentukan struktur data dari API
interface DataItem {
  [key: string]: string;
}

export default function Home() {
  const [query, setQuery] = useState<string>('');
  const [data, setData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Ambil semua data saat halaman pertama kali dibuka
  useEffect(() => {
    fetchData('');
  }, []);

  const fetchData = async (searchQuery: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const result = await res.json();
      if (Array.isArray(result)) {
        setData(result);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    fetchData(query);
  };

  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Pencarian Data Google Sheets</h2>
      
      {/* Form Input Pencarian */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Cari data..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 14px',
            fontSize: '16px',
            borderRadius: '6px',
            border: '1px solid #ccc'
          }}
        />
        <button
          type="submit"
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Mencari...' : 'Cari'}
        </button>
      </form>

      {/* Tabel Hasil Pencarian */}
      {data.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table border={1} cellPadding="10" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', borderColor: '#eee' }}>
            <thead>
              <tr style={{ backgroundColor: '#f4f4f4', textAlign: 'left' }}>
                {Object.keys(data[0]).map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={index}>
                  {Object.values(item).map((val, i) => (
                    <td key={i}>{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>{loading ? 'Memuat data...' : 'Tidak ada data ditemukan.'}</p>
      )}
    </main>
  );
}