import React, { useEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
} from "reactflow";
import type { Node, Edge } from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";

import {
  getCritique,
  getDateTot,
  getDateTard,
  getMarge,
  saveTasks,
} from "../services/cpmServices";
import type { Task } from "../types/task";

// Configuration du layout Dagre
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 220;
const nodeHeight = 180;

// Fonction pour appliquer le layout Dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? 'left' : 'top';
    node.sourcePosition = isHorizontal ? 'right' : 'bottom';

    // Dagre donne la position du centre du nœud, nous devons ajuster
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};

export default function TaskGraph() {
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState<Task>({
    nom: "",
    duree: 1,
    preced: [],
    succ: [],
  });
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [tableData, setTableData] = useState<Task[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB');

  // Fonction pour gérer les changements (drag & drop) des noeuds
  const onNodesChange = (changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  };

  // Fonction pour gérer les changements des arêtes
  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  };

  const expandGroupedDates = (data: Record<string, number>): Record<string, number> => {
    const expanded: Record<string, number> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (/^[A-Z]+$/.test(key) && key.length > 1) {
        key.split("").forEach((letter) => {
          expanded[letter] = value;
        });
      } else {
        expanded[key] = value;
      }
    });
    return expanded;
  };

  const handleLoadExample = () => {
    const exampleTasks =[
  { nom: "A", duree: 7, preced: [], succ: ["B"] },
  { nom: "B", duree: 7, preced: ["A"], succ: ["C"] },
  { nom: "C", duree: 15, preced: ["B"], succ: ["D"] },
  { nom: "D", duree: 30, preced: ["C"], succ: ["E", "G", "H"] },
  { nom: "E", duree: 45, preced: ["D"], succ: ["F"] },
  { nom: "F", duree: 15, preced: ["E"], succ: ["K"] },
  { nom: "G", duree: 45, preced: ["D"], succ: ["M"] },
  { nom: "H", duree: 60, preced: ["D"], succ: ["I"] },
  { nom: "I", duree: 20, preced: ["H"], succ: ["J"] },
  { nom: "J", duree: 30, preced: ["I"], succ: ["M"] },
  { nom: "K", duree: 30, preced: ["F"], succ: ["L"] },
  { nom: "L", duree: 15, preced: ["K"], succ: ["M"] },
  { nom: "M", duree: 30, preced: ["G", "J", "L"], succ: ["N", "P"] },
  { nom: "N", duree: 15, preced: ["M"], succ: ["O"] },
  { nom: "O", duree: 30, preced: ["N"], succ: ["Q"] },
  { nom: "P", duree: 15, preced: ["M"], succ: ["T"] },
  { nom: "Q", duree: 15, preced: ["O"], succ: ["R", "S"] },
  { nom: "R", duree: 15, preced: ["Q"], succ: ["U", "W"] },
  { nom: "S", duree: 30, preced: ["Q"], succ: ["V", "W"] },
  { nom: "T", duree: 7, preced: ["P"], succ: ["U", "V"] },
  { nom: "U", duree: 4, preced: ["R", "T"], succ: [] },
  { nom: "V", duree: 2, preced: ["S", "T"], succ: [] },
  { nom: "W", duree: 7, preced: ["R", "S"], succ: [] }
];

    setTaskList(exampleTasks);
    setNewTask({ nom: "", duree: 1, preced: [], succ: [] });
    setNodes([]);
    setEdges([]);
    setTableData([]);
    setIsEditing(false);
  };

  const handleAddTask = () => {
    const nomTrim = newTask.nom.trim().toUpperCase();
    if (!nomTrim) return alert("Le nom de la tâche est requis.");
    if (taskList.some((t) => t.nom === nomTrim))
      return alert("Une tâche avec ce nom existe déjà.");
    if (newTask.duree < 1) return alert("La durée doit être au moins 1.");

    const succTrimmed = (newTask.succ || [])
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    setTaskList([...taskList, { ...newTask, nom: nomTrim, succ: succTrimmed }]);
    setNewTask({ nom: "", duree: 1, preced: [], succ: [] });
  };

  // Modifier la tâche sélectionnée
  const handleUpdateTask = () => {
    const nomTrim = newTask.nom.trim().toUpperCase();
    if (!nomTrim) return alert("Le nom de la tâche est requis.");
    if (newTask.duree < 1) return alert("La durée doit être au moins 1.");

    const succTrimmed = (newTask.succ || [])
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    setTaskList((prev) =>
      prev.map((t) =>
        t.nom === nomTrim ? { ...newTask, nom: nomTrim, succ: succTrimmed } : t
      )
    );
    setNewTask({ nom: "", duree: 1, preced: [], succ: [] });
    setIsEditing(false);
  };

  // Supprimer la tâche sélectionnée
  const handleDeleteTask = () => {
    if (!newTask.nom) return;
    setTaskList((prev) => prev.filter((t) => t.nom !== newTask.nom));
    setNewTask({ nom: "", duree: 1, preced: [], succ: [] });
    setIsEditing(false);
  };

  // Fonction pour réorganiser le layout
  const handleLayoutChange = (direction: 'TB' | 'LR') => {
    setLayoutDirection(direction);
    if (nodes.length > 0 && edges.length > 0) {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        direction
      );
      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
    }
  };

  const handleRecalculate = async () => {
    if (taskList.length === 0) return;

    try {
      // Recalcul temporaire sans toucher à taskList
      const recomputedTaskList = taskList.map((task) => ({
        ...task,
        preced: taskList
          .filter((t) => (t.succ || []).includes(task.nom))
          .map((t) => t.nom),
      }));

      await saveTasks(recomputedTaskList);

      const [tot, tard, marge, critique] = await Promise.all([
        getDateTot(),
        getDateTard(),
        getMarge(),
        getCritique(),
      ]);

      console.log("Résultat brut des APIs :");
      console.log("Date Totale (tot):", tot.data);
      console.log("Date Tardive (tard):", tard.data);
      console.log("Marge:", marge.data);
      console.log("Tâches critiques:", critique.data);

      const dateTotMap = expandGroupedDates(tot.data);
      const dateTardMap = expandGroupedDates(tard.data);
      const margeMap = expandGroupedDates(marge.data);
      const critiqueList: string[] = critique.data;

      const debutNodeId = "DEBUT";
      const finNodeId = "FIN";

      const graphNodes: Node[] = [
        {
          id: debutNodeId,
          position: { x: 0, y: 0 },
          data: {
            label: (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 100,
                  height: 100,
                  backgroundColor: "#facc15",
                  border: "2px solid #ca8a04",
                  borderRadius: "50%",
                  fontWeight: "bold",
                }}
              >
                DÉBUT
              </div>
            ),
          },
          style: {
            width: 100,
            height: 100,
            background: "transparent",
            border: "none",
          },
          draggable: false,
        },
        {
          id: finNodeId,
          position: { x: 0, y: 0 },
          data: {
            label: (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 100,
                  height: 100,
                  backgroundColor: "#facc15",
                  border: "2px solid #ca8a04",
                  borderRadius: "50%",
                  fontWeight: "bold",
                }}
              >
                FIN
              </div>
            ),
          },
          style: {
            width: 100,
            height: 100,
            background: "transparent",
            border: "none",
          },
          draggable: false,
        },
        ...recomputedTaskList.map((task) => {
          const isCritique = critiqueList.includes(task.nom);

          const latestSuccDate = (task.succ || [])
            .map((s) => dateTardMap[s])
            .filter((d) => d !== undefined);
          const maxSuccTard =
            latestSuccDate.length > 0 ? Math.min(...latestSuccDate) : "-";

          return {
            id: task.nom,
            position: { x: 0, y: 0 },
            connectable: false,
            data: {
              label: (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 100,
                    height: 100,
                    backgroundColor: "white",
                    border: `2px solid ${isCritique ? "#dc2626" : "#6b7280"}`,
                    borderRadius: "50%",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                    fontSize: 12,
                    fontWeight: "bold",
                    color: "#111827",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      width: "80%",
                      marginTop: "25px",
                    }}
                  >
                    <span style={{ color: "#dc2626" }}>{dateTotMap[task.nom] ?? "-"}</span>
                    <span style={{ color: "#1e3a8a" }}>{maxSuccTard}</span>
                  </div>
                  <div style={{ marginTop: 8 }}>{task.nom}</div>
                </div>
              ),
            },
            style: {
              width: 100,
              height: 100,
              background: "transparent",
              border: "none",
            },
            draggable: true,
          };
        }),
      ];

      const graphEdges: Edge[] = [];

      recomputedTaskList.forEach((task) => {
        (task.succ || []).forEach((succ) => {
          const targetTask = recomputedTaskList.find((t) => t.nom === succ);
          if (targetTask) {
            const isCritique =
              critiqueList.includes(task.nom) && critiqueList.includes(succ);

            graphEdges.push({
              id: `${task.nom}-${succ}`,
              source: task.nom,
              target: succ,
              animated: isCritique,
              label: `${succ} (${targetTask.duree})`,
              style: {
                stroke: isCritique ? "#dc2626" : "#6b7280",
                strokeWidth: isCritique ? 4 : 2,
              },
              labelStyle: {
                fontSize: "12px",
                fontWeight: "600",
                fill: isCritique ? "#dc2626" : "#374151",
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: isCritique ? "#dc2626" : "#6b7280",
                width: 18,
                height: 18,
              },
            });
          }
        });
      });

      recomputedTaskList
        .filter((task) => task.preced.length === 0)
        .forEach((task) => {
          graphEdges.push({
            id: `DEBUT-${task.nom}`,
            source: debutNodeId,
            target: task.nom,
            style: { stroke: "#6b7280" },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#6b7280",
              width: 18,
              height: 18,
            },
          });
        });

      recomputedTaskList
        .filter((task) => (task.succ || []).length === 0)
        .forEach((task) => {
          graphEdges.push({
            id: `${task.nom}-FIN`,
            source: task.nom,
            target: finNodeId,
            style: { stroke: "#6b7280" },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#6b7280",
              width: 18,
              height: 18,
            },
          });
        });

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        graphNodes,
        graphEdges,
        layoutDirection
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      const calculatedTasks = recomputedTaskList.map((task) => ({
        ...task,
        dateTot: dateTotMap[task.nom],
        dateTard: dateTardMap[task.nom],
        marge: margeMap[task.nom],
      }));
      setTableData(calculatedTasks);
    } catch (error) {
      console.error("Erreur CPM:", error);
      alert("Erreur lors du calcul. Vérifiez la console.");
    }
  };



  // Chargement des données dans le formulaire au clic sur un nœud
  const onNodeClick = (_event: React.MouseEvent, node: Node) => {
    const task = taskList.find((t) => t.nom === node.id);
    if (task) {
      setNewTask(task);
      setIsEditing(true);
    }
  };

  useEffect(() => {
    console.log("taskList mis à jour :", taskList);
  }, [taskList]);

  const handleReset = () => {
    setTaskList([]);
    setNodes([]);
    setEdges([]);
    setTableData([]);
    setNewTask({ nom: "", duree: 1, preced: [], succ: [] });
    setIsEditing(false);
  };

  return (
    <div className="cpm-container" style={{ padding: 20 }}>
      <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>
        Ajouter / Modifier une tâche
      </h2>
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          placeholder="Nom de la tâche"
          value={newTask.nom}
          disabled={isEditing}
          onChange={(e) =>
            setNewTask({ ...newTask, nom: e.target.value.toUpperCase() })
          }
          style={{ 
            minWidth: 150,
            padding: "8px 12px",
            fontSize: "16px",
            borderRadius: "6px",
            border: "1px solid #d1d5db"
          }}
        />
        <input
          type="number"
          placeholder="Durée"
          min={1}
          value={newTask.duree}
          onChange={(e) =>
            setNewTask({ ...newTask, duree: Number(e.target.value) })
          }
          style={{ 
            minWidth: 100,
            padding: "8px 12px",
            fontSize: "16px",
            borderRadius: "6px",
            border: "1px solid #d1d5db"
          }}
        />
        <input
          type="text"
          placeholder="Successeurs (ex: B,C)"
          value={(newTask.succ || []).join(",")}
          onChange={(e) =>
            setNewTask({
              ...newTask,
              succ: e.target.value
                .split(",")
                .map((p) => p.trim().toUpperCase())
                .filter((p) => p.length > 0),
            })
          }
          style={{ 
            minWidth: 150,
            padding: "8px 12px",
            fontSize: "16px",
            borderRadius: "6px",
            border: "1px solid #d1d5db"
          }}
        />

        {!isEditing ? (
          <button 
            onClick={handleAddTask}
            style={{
              padding: "8px 16px",
              fontSize: "16px",
              backgroundColor: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            Ajouter
          </button>
        ) : (
          <>
            <button 
              onClick={handleUpdateTask}
              style={{
                padding: "8px 16px",
                fontSize: "16px",
                backgroundColor: "#f59e0b",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Modifier
            </button>
            <button 
              onClick={handleDeleteTask}
              style={{
                padding: "8px 16px",
                fontSize: "16px",
                backgroundColor: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Supprimer
            </button>
            <button
              onClick={() => {
                setNewTask({ nom: "", duree: 1, preced: [], succ: [] });
                setIsEditing(false);
              }}
              style={{
                padding: "8px 16px",
                fontSize: "16px",
                backgroundColor: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Annuler
            </button>
          </>
        )}

        <button 
          onClick={handleRecalculate} 
          disabled={taskList.length === 0}
          style={{
            padding: "8px 16px",
            fontSize: "16px",
            backgroundColor: taskList.length === 0 ? "#9ca3af" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: taskList.length === 0 ? "not-allowed" : "pointer"
          }}
        >
          Recalculer
        </button>
        <button 
          onClick={handleReset}
          style={{
            padding: "8px 16px",
            fontSize: "16px",
            backgroundColor: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Réinitialiser
        </button>
        <button 
          onClick={handleLoadExample}
          style={{
            padding: "8px 16px",
            fontSize: "16px",
            backgroundColor: "#8b5cf6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Charger Exemple
        </button>
      </div>

      {/* Contrôles de layout */}
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "10px" }}>
          Orientation du graphique:
        </h3>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => handleLayoutChange('TB')}
            style={{
              padding: "8px 16px",
              fontSize: "16px",
              backgroundColor: layoutDirection === 'TB' ? "#3b82f6" : "#9ca3af",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            Vertical (Haut → Bas)
          </button>
          <button
            onClick={() => handleLayoutChange('LR')}
            style={{
              padding: "8px 16px",
              fontSize: "16px",
              backgroundColor: layoutDirection === 'LR' ? "#3b82f6" : "#9ca3af",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            Horizontal (Gauche → Droite)
          </button>
        </div>
      </div>

      {taskList.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "10px" }}>
            Liste des tâches:
          </h3>
          <ul style={{ fontSize: "16px", lineHeight: "1.6" }}>
            {taskList.map((task, idx) => (
              <li key={idx} style={{ marginBottom: "4px" }}>
                <strong>{task.nom}</strong> ({task.duree}) - successeurs:{" "}
                {(task.succ || []).join(", ") || "-"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ 
        width: "100%", 
        height: "80vh", 
        margin: "20px 0",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        overflow: "hidden"
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <Background color="#f3f4f6" />
          <Controls />
        </ReactFlow>
      </div>

      {tableData.length > 0 && (
        <div style={{ marginTop: "30px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "15px" }}>
            Tableau résumé
          </h2>
          <table 
            border={1} 
            cellPadding={12}
            style={{ 
              borderCollapse: "collapse",
              width: "100%",
              fontSize: "16px"
            }}
          >
            <thead>
              <tr>
                <th style={{ fontWeight: "600", padding: "12px" }}>Nom</th>
                <th style={{ fontWeight: "600", padding: "12px" }}>Durée</th>
                <th style={{ fontWeight: "600", padding: "12px" }}>Successeurs</th>
                <th style={{ fontWeight: "600", padding: "12px" }}>Date Tot</th>
                <th style={{ fontWeight: "600", padding: "12px" }}>Date Tard</th>
                <th style={{ fontWeight: "600", padding: "12px" }}>Marge</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((t, i) => (
                <tr key={i} >
                  <td style={{ padding: "12px", fontWeight: "600" }}>{t.nom}</td>
                  <td style={{ padding: "12px" }}>{t.duree}</td>
                  <td style={{ padding: "12px" }}>{(t.succ || []).join(", ") || "-"}</td>
                  <td style={{ padding: "12px" }}>{t.dateTot}</td>
                  <td style={{ padding: "12px" }}>{t.dateTard}</td>
                  <td style={{ padding: "12px" }}>{t.marge}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}