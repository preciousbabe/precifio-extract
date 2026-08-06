// src/hooks/useReconciliation.js
import { useState, useCallback } from "react";
import { reconcileService } from "../services/reconcileService";

export function useReconciliation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [results, setResults] = useState(null);
  const [matchConfig, setMatchConfig] = useState(null);

    const withLoading = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err.message || "An error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);


  
  const fetchWorkspaces = useCallback(async () => {
    const data = await withLoading(() => reconcileService.listWorkspaces());
    setWorkspaces(data.workspaces || []);
    return data.workspaces;
  }, []);

  const fetchConsent = useCallback(async () => {
    return await withLoading(() => reconcileService.getConsent());
  }, []);

    const grantConsent = useCallback(async (granted = true, settings = {}) => {
    const data = await withLoading(() => reconcileService.updateConsent(granted, settings));
    return data;
  }, []);

  const fetchFieldAliases = useCallback(async () => {
    return await withLoading(() => reconcileService.getFieldAliases());
  }, []);

  const saveFieldAlias = useCallback(async (payload) => {
    return await withLoading(() => reconcileService.saveFieldAlias(payload));
  }, []);

  const deleteFieldAlias = useCallback(async (id) => {
    return await withLoading(() => reconcileService.deleteFieldAlias(id));
  }, []);

  const deleteAllData = useCallback(async () => {
    return await withLoading(() => reconcileService.deleteAllData());
  }, []);


  const createWorkspace = useCallback(async (payload) => {
    const data = await withLoading(() => reconcileService.createWorkspace(payload));
    setCurrentWorkspace(data.workspace);
    return data.workspace;
  }, []);


    const deleteWorkspace = useCallback(async (workspace_id) => {
    return await withLoading(() => reconcileService.deleteWorkspace(workspace_id));
  }, []);

  const addDocuments = useCallback(async (workspace_id, dataset_side, documents) => {
    return await withLoading(() => reconcileService.addDocuments(workspace_id, dataset_side, documents));
  }, []);

    const removeDocument = useCallback(async (document_id) => {
    return await withLoading(() => reconcileService.removeDocument(document_id));
  }, []);

  const fetchMatchConfig = useCallback(async (workspace_id) => {
    const data = await withLoading(() => reconcileService.getMatchConfig(workspace_id));
    setMatchConfig(data.configuration);
    return data;
  }, []);

  const saveMatchConfig = useCallback(async (workspace_id, configuration) => {
    const data = await withLoading(() => reconcileService.saveMatchConfig(workspace_id, configuration));
    setMatchConfig(data.configuration);
    return data;
  }, []);

  const runReconciliation = useCallback(async (workspace_id) => {
    const data = await withLoading(() => reconcileService.runReconciliation(workspace_id));
    return data;
  }, []);

  const fetchResults = useCallback(async (workspace_id, status, side) => {
    const data = await withLoading(() => reconcileService.getResults(workspace_id, status, side));
    setResults(data);
    setCurrentWorkspace(data.workspace);
    return data;
  }, []);

  return {
    loading,
    error,
    workspaces,
    currentWorkspace,
    results,
    matchConfig,
    fetchWorkspaces,
    fetchConsent,
    grantConsent,
    createWorkspace,
    addDocuments,
     removeDocument,
    deleteWorkspace,
    fetchMatchConfig,
    saveMatchConfig,
    runReconciliation,
    fetchResults,
    fetchFieldAliases,
    saveFieldAlias,
    deleteFieldAlias,
    deleteAllData,
  };
}