import { useState, useEffect } from "react"
import "./App.css"

function App() {
  const [file, setFile] = useState(null)
  const [message, setMessage] = useState("")
  const [documents, setDocuments] = useState([])
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [chunks, setChunks] = useState([])
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [searchError, setSearchError] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchMode, setSearchMode] = useState("semantic")
  const [selectedSearchDocument, setSelectedSearchDocument] = useState("all")

  const fetchDocuments = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/documents")
      const data = await response.json()

      setDocuments(data)
    }  catch (error) {
      console.error(error)
    }
  }

  const fetchChunks = async (documentId) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/documents/${documentId}/chunks`
      )
      
      const data = await response.json()

      setChunks(data)
    } catch (error) {
      console.error(error)
    }
  }

  const handleDelete = async (documentId, filename) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${filename}"?`
    )
    if (!confirmed) {
      return
    }
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/documents/${documentId}`,
        {
          method: "DELETE",
        }
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || "Failed to delete document")
      }

      await fetchDocuments()

      if (selectedDocument?.id === documentId) {
        setSelectedDocument(null)
        setChunks([])
      }

      if (selectedSearchDocument === String(documentId)) {
        setSelectedSearchDocument("all")
      }

      setMessage(`${filename} deleted successfully.`)
    } catch (error) {
      console.error(error)
      setMessage(error.message || "Could not delete document.")
    }
  }

  const handleSearch = async () => {
    if (!query.trim()) {
      setSearchResults([])
      setSearchError("")
      setHasSearched(true)
      return
    }

    setSearchLoading(true)
    setHasSearched(true)
    setSearchResults([])
    setSearchError("")

    try {
      const endpoint = 
        searchMode === "semantic"
        ? "/semantic-search"
        : "/search"
      
      const documentParam = 
        selectedSearchDocument === "all"
        ? ""
        : `&document_id=${selectedSearchDocument}`
      
      const response = await fetch(
        `http://127.0.0.1:8000${endpoint}?q=${encodeURIComponent(query)}${documentParam}`
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || "Search failed")
      }

      setSearchResults(data)
    } catch (error) {
      console.error(error)

      if (error.message === "Failed to fetch") {
        setSearchError(
          "Could not connect to StudyVault. Please check that the backend is running and try again."
        )
      } else {
        setSearchError(
          error.message || "Something went wrong. PLease try again."
        )
      }
    } finally {
      setSearchLoading(false)
    }
  }

  const handleClearSearch = () => {
    setQuery("")
    setSearchResults([])
    setSearchError("")
    setHasSearched(false)
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  const handleFileChange = (event) => {
    setFile(event.target.files[0])
    setMessage("")
  }

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a PDF first.")
      return
    }
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        await fetchDocuments()
        setMessage("Upload successful!")
        setFile(null)
        console.log(data)
      } else {
        setMessage(data.detail || "Upload failed.")
      }
    } catch (error) {
      console.error(error)
      setMessage("Could not connect to backend.")
    }
  }

  
return (
  <div className="app-container">
    <header className="app-header">
      <div>
        <h1>StudyVault</h1>
        <p>Your personal document vault</p>
      </div>
    </header>

    <div className="app-layout">
      {/* LEFT SIDEBAR */}
      <aside className="sidebar">

        <section className="panel upload-box">
          <h2>Upload PDF</h2>

          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
          />

          {file && <p>Selected: {file.name}</p>}

          <button onClick={handleUpload}>
            Upload PDF
          </button>

          {message && (
            <p className="status-message">{message}</p>
          )}
        </section>

        <section className="panel document-library">
          <h2>Your Library</h2>

          <p>{documents.length} document(s)</p>

          {documents.length === 0 ? (
            <p>No documents uploaded yet.</p>
          ) : (
            <div className="document-list">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className={`document-item ${
                    selectedDocument?.id === document.id
                      ? "selected"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedDocument(document)
                    fetchChunks(document.id)
                  }}
                >
                  <div className="document-info">
                    <h3 title={document.filename}>{document.filename}</h3>
                    <p>{document.pages} pages</p>
                  </div>

                  <button
                    className="delete-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleDelete(
                        document.id,
                        document.filename
                      )
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="main-workspace">

        <section className="panel search-panel">
          <h2>Search Your Study Material</h2>
          <p>
            Find relevant information across your uploaded PDFs.
          </p>

          <div className="search-modes">
            <button
              className={
                searchMode === "semantic" ? "active" : ""
              }
              onClick={() => setSearchMode("semantic")}
            >
              Semantic Search
            </button>

            <button
              className={
                searchMode === "keyword" ? "active" : ""
              }
              onClick={() => setSearchMode("keyword")}
            >
              Keyword Search
            </button>
          </div>

          <p className="current-mode">
            Current mode: {searchMode}
          </p>

          <label htmlFor="search-document">
            Search within
          </label>

          <select
            id="search-document"
            value={selectedSearchDocument}
            onChange={(event) =>
              setSelectedSearchDocument(event.target.value)
            }
          >
            <option value="all">All Documents</option>

            {documents.map((document) => (
              <option
                key={document.id}
                value={document.id}
              >
                {document.filename}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Ask or search something..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="search-actions">
            <button
              onClick={handleSearch}
              disabled={searchLoading}
            >
              {searchLoading ? "Searching..." : "Search"}
            </button>

            <button
              onClick={handleClearSearch}
              disabled={searchLoading}
            >
              Clear Search
            </button>
          </div>

          {searchError && (
            <p className="search-error">{searchError}</p>
          )}

          {hasSearched &&
            !searchLoading &&
            !searchError &&
            searchResults.length === 0 && (
              <p className="empty-state">
                No results found. Try different keywords
                or change your search filters.
              </p>
            )}

          {searchResults.length > 0 && (
            <div className="search-results">
              <h2>Search Results</h2>

              {searchResults.map((result) => (
                <div
                  className="result-card"
                  key={result.chunk_id}
                >
                  <h3>{result.filename}</h3>
                  <h4>Chunk {result.chunk_index}</h4>

                  <p>{result.text}</p>

                  {searchMode === "semantic" && (
                    <p className="similarity">
                      Similarity: {typeof result.similarity === "number"
                      ? result.similarity.toFixed(3)
                    : "Unavailable"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SELECTED DOCUMENT CONTENT */}
        {selectedDocument && (
          <section className="panel chunks-panel">
            <div className="document-viewer-header">
              <div className="document-viewer-title">
                <h2 title={selectedDocument.filename}>
                  {selectedDocument.filename}
                </h2>
                <p>PDF Document</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => {
                  setSelectedDocument(null)
                  setChunks([])
                }}>
                  ✕ Close
                </button>
            </div>
            <div className="document-content">
              {chunks.map((chunk) => (
                <p key={chunk.id}>{chunk.text}</p>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  </div>
)


  // return (
  //   <div>
  //     <h1>StudyVault</h1>
  //     <p>Your personal document vault</p>

  //     <div className="upload-box">
  //       <h2>Upload your study PDF</h2>

  //       <input 
  //       type="file" 
  //       accept=".pdf" 
  //       onChange={handleFileChange} />

  //       {file && <p>Selected: {file.name}</p>}

  //       <button onClick={handleUpload}>
  //         Upload PDF
  //       </button>

  //       {message && <p>{message}</p>}
  //     </div>
  //     <div>
  //       <h2>Search your documents</h2>

  //       <button onClick={() => setSearchMode("semantic")}>
  //         Semantic Search
  //       </button>

  //       <button onClick={() => setSearchMode("keyword")}>
  //         Keyword Search
  //       </button>

  //       <p>Current mode: {searchMode}</p>

  //       <select 
  //         value={selectedSearchDocument}
  //         onChange={(event) => setSelectedSearchDocument(event.target.value)}
  //       >
  //         <option value="all">All Documents</option>

  //         {documents.map((document) => (
  //           <option key={document.id} value={document.id}>
  //             {document.filename}
  //           </option>
  //         ))}
  //       </select>

  //       <input 
  //         type="text"
  //         placeholder="Ask or search something..."
  //         value={query}
  //         onChange={(event) => setQuery(event.target.value)}
  //       />

  //       <button onClick={handleSearch} disabled={searchLoading}>
  //         {searchLoading ? "Searching..." : "Search"}
  //       </button>
  //       <button onClick={handleClearSearch} disabled={searchLoading}>
  //         Clear Search
  //       </button>

  //     </div>
  //     {searchError && (
  //       <p style={{color: "red"}}>
  //         {searchError}
  //       </p>
  //     )}
  //     {searchResults.length > 0 && (
  //       <div>
  //         <h2>Search Results</h2>
  //         {searchResults.map((result) => (
  //           <div key={result.chunk_id}>
  //             <h3>{result.filename}</h3>
  //             <h4>Chunk {result.chunk_index}</h4>

  //             <p>{result.text}</p>

  //             {searchMode === "semantic" && (
  //               <p>
  //                 Similarity: {result.similarity.toFixed(3)}
  //               </p>
  //             )}
  //           </div>
  //         ))}
  //       </div>
  //     )}
  //     {hasSearched && !searchLoading && !searchError && searchResults.length === 0 && (
  //       <p>No results found. Try different keywords or change your search filters.</p>
  //     )}
  //     <div>
  //       <h2>Your Documents</h2>
  //       {documents.length === 0 ? (
  //         <p>No documents uploaded yet.</p>
  //       ) : (
  //         documents.map((document) => (
  //           <div 
  //             key={document.id}
  //             onClick={() => {
  //               setSelectedDocument(document)
  //               fetchChunks(document.id)
  //             }}
  //           >
  //             <h3>{document.filename}</h3>
  //             <p>{document.pages} pages</p>

  //             <button
  //               onClick={() => handleDelete(document.id, document.filename)}
  //             >
  //               Delete
  //             </button>
  //           </div>
  //         ))
  //       )}
  //     </div>
  //     {selectedDocument && (
  //       <div>
  //         <h2>{selectedDocument.filename} - Chunks</h2>

  //         {chunks.map((chunk) => (
  //           <div key={chunk.id}>
  //             <h3>Chunk {chunk.chunk_index}</h3>
  //             <p>{chunk.text}</p>
  //           </div>
  //         ))}
  //       </div>
  //     )}
  //   </div>
  // )
}

export default App