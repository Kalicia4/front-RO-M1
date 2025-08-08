import React, { useState } from "react";
import axios from "axios";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { Plus, Edit3, X, Clock, Users, ArrowRight, Target, Sparkles } from "lucide-react";

type Task = {
  nom: string;
  duree: number;
  preced: string[];
  succ: string[];
};

const API_BASE = "http://localhost:8080/api/tache";
const nodeWidth = 160;
const nodeHeight = 100;

export default function TaskForm() {
  const [nom, setNom] = useState("");
  const [duree, setDuree] = useState("");
  const [preced, setPreced] = useState("");
  const [succ, setSucc] = useState("");

  const [links, setLinks] = useState<Record<string, string[]>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [result, setResult] = useState<{
    dateTot: Record<string, number>;
    dateTard: Record<string, number>;
    marge: Record<string, number>;
    critique: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataSent, setDataSent] = useState(false);
  const [editingTask, setEditingTask] = useState<number | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const handleAddTask = () => {
    if (!nom.trim() || !duree) {
      alert("Nom et durée obligatoires");
      return;
    }

    // Vérifier si le nom de la tâche existe déjà (sauf si on modifie)
    if (editingTask === null && tasks.some(task => task.nom === nom.trim())) {
      alert("Une tâche avec ce nom existe déjà");
      return;
    }

    const newTask: Task = {
      nom: nom.trim(),
      duree: parseInt(duree),
      preced: preced ? preced.split(",").map((s) => s.trim()) : [],
      succ: succ ? succ.split(",").map((s) => s.trim()) : [],
    };

    if (editingTask !== null) {
      // Modification d'une tâche existante
      const updatedTasks = [...tasks];
      updatedTasks[editingTask] = newTask;
      setTasks(updatedTasks);
      setEditingTask(null);
    } else {
      // Ajout d'une nouvelle tâche
      setTasks([...tasks, newTask]);
    }

    setNom("");
    setDuree("");
    setPreced("");
    setSucc("");
    setDataSent(false);
    setResult(null);
    setEditingTask(null);
  };

  const handleEditTask = (index: number) => {
    const task = tasks[index];
    setNom(task.nom);
    setDuree(task.duree.toString());
    setPreced(task.preced.join(", "));
    setSucc(task.succ.join(", "));
    setEditingTask(index);
    setDataSent(false);
    setResult(null);
  };

  const handleDeleteTask = (index: number) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette tâche ?")) {
      const taskToDelete = tasks[index];
      const { preced, succ, nom } = taskToDelete;

      // Mise à jour des liens dans les autres tâches
      const updatedTasks = tasks.map((task, i) => {
        if (i === index) return task; // on ne modifie pas encore la tâche à supprimer

        let newPreced = [...task.preced];
        let newSucc = [...task.succ];

        // Si ce task avait la tâche à supprimer comme prédécesseur → on remplace par ses prédécesseurs
        if (newPreced.includes(nom)) {
          newPreced = newPreced.filter(p => p !== nom);
          newPreced.push(...preced.filter(p => !newPreced.includes(p)));
        }

        // Si ce task avait la tâche à supprimer comme successeur → on remplace par ses successeurs
        if (newSucc.includes(nom)) {
          newSucc = newSucc.filter(s => s !== nom);
          newSucc.push(...succ.filter(s => !newSucc.includes(s)));
        }

        return { ...task, preced: newPreced, succ: newSucc };
      });

      // Suppression définitive de la tâche
      const finalTasks = updatedTasks.filter((_, i) => i !== index);

      setTasks(finalTasks);
      setDataSent(false);
      setResult(null);

      if (editingTask === index) {
        setNom("");
        setDuree("");
        setPreced("");
        setSucc("");
        setEditingTask(null);
      } else if (editingTask !== null && editingTask > index) {
        setEditingTask(editingTask - 1);
      }
    }
  };

  const handleCancelEdit = () => {
    setNom("");
    setDuree("");
    setPreced("");
    setSucc("");
    setEditingTask(null);
  };

  const handleSendData = async () => {
    setError(null);
    setResult(null);
    if (tasks.length === 0) {
      alert("Ajoutez au moins une tâche avant d'envoyer");
      return;
    }
    try {
      const autoRes = await axios.post(`${API_BASE}/auto`, tasks);
      const originalLinks = autoRes.data;

        // Créer une copie des liens pour les compléter
        const completedLinks = { ...originalLinks };

        // Ajouter les tâches sans successeur comme prédécesseurs du nœud "END"
        tasks.forEach(task => {
        const hasSucc = tasks.some(t => t.preced.includes(task.nom));
        if (!hasSucc && task.nom !== "END" && task.nom !== "START") {
            if (!completedLinks["END"]) {
            completedLinks["END"] = [];
            }
            completedLinks["END"].push(task.nom);
        }
        });

        setLinks(completedLinks);
      setDataSent(true);
      alert("Données envoyées avec succès !");
    } catch (err: any) {
      console.error("Error sending data:", err);
      setError(err.response?.data?.message || "Erreur lors de l'envoi des données");
      setDataSent(false);
    }
  };

  const handleCalculate = async () => {
    setError(null);
    setResult(null);

    if (!dataSent) {
      alert("Veuillez d'abord envoyer les données avant de calculer");
      return;
    }

    try {
      const [dateTotRes, critiqueRes, dateTardRes, margeRes] = await Promise.all([
        axios.get(`${API_BASE}/dateTot`),
        axios.get(`${API_BASE}/critique`),
        axios.get(`${API_BASE}/dateTard`),
        axios.get(`${API_BASE}/marge`),
      ]);

      console.log("API responses:", {
        dateTot: dateTotRes.data,
        critique: critiqueRes.data,
        dateTard: dateTardRes.data,
        marge: margeRes.data
      });

      const resultData = {
        dateTot: dateTotRes.data,
        critique: critiqueRes.data,
        dateTard: dateTardRes.data,
        marge: margeRes.data,
      };

      setResult(resultData);
      generateCPMGraph(tasks, resultData, links);
    } catch (err: any) {
      console.error("Error calculating:", err);
      setError(err.response?.data?.message || "Erreur lors du calcul");
    }
  };

  const generateCPMGraph = (tasks: Task[], result: any, links: Record<string, string[]>) => {
    console.log("Generating CPM graph with:", { tasks, result, links });

    if (!links || Object.keys(links).length === 0) {
      console.error("No links available for graph generation");
      return;
    }

    const nodesSet = new Set<string>();
    const taskEdges: any[] = [];

    // Ajouter START et END
    nodesSet.add("START");
    nodesSet.add("END");
    

    // Construire les arêtes à partir de links
    Object.entries(links).forEach(([target, sources]) => {
      sources.forEach(source => {
        const from = source === "-" ? "START" : source;
        const to = target;

        nodesSet.add(from);
        nodesSet.add(to);

        const task = tasks.find(t => t.nom === to);
        const critiquePath = (result?.critique || []).map((name: string) =>
            name === "Début" ? "START" :
            name === "fin" ? "END" :
            name
        );
        const fromIndex = critiquePath.indexOf(from);
        const isCritique = fromIndex !== -1 && critiquePath[fromIndex + 1] === to;

        const marge = result?.marge?.[to] ?? 0;

        taskEdges.push({
          id: `${from}-${to}`,
          source: from,
          target: to,
          label: task ? `${to}\n(${task.duree}j)\nMarge: ${marge}` : to,
          animated: isCritique,
          style: {
            stroke: isCritique ? "#dc2626" : "#334155",
            strokeWidth: isCritique ? 3 : 2,
          },
          labelStyle: {
            fill: isCritique ? "#dc2626" : "#000",
            fontWeight: isCritique ? "bold" : "normal",
            fontSize: 11,
          },
          labelBgStyle: {
            fill: "#ffffff",
            fillOpacity: 0.8,
          },
            markerEnd: {
              type: 'arrowclosed',
            },
        });
      });
    });

    // Algorithme de positionnement en couches
    const layers: string[][] = [["START"]];
    const processed = new Set(["START"]);
    
    // Construire les couches
    while (processed.size < nodesSet.size) {
      const nextLayer: string[] = [];
      
      Array.from(nodesSet).forEach(node => {
        if (!processed.has(node) && node !== "END") {
          const prerequisites = links[node] || [];
          const canProcess = prerequisites.every(pred => 
            pred === "-" || processed.has(pred)
          );
          
          if (canProcess) {
            nextLayer.push(node);
          }
        }
      });
      
      // Si aucune tâche ne peut être traitée, ajouter END
      if (nextLayer.length === 0 && !processed.has("END")) {
        nextLayer.push("END");
      }
      
      if (nextLayer.length > 0) {
        layers.push(nextLayer);
        nextLayer.forEach(node => processed.add(node));
      } else {
        break;
      }
    }

    console.log("Generated layers:", layers);

    // Créer les nœuds avec positionnement
    const eventNodes = Array.from(nodesSet).map(eventId => {
      // Trouver la couche et la position de ce nœud
      let layerIndex = 0;
      let positionInLayer = 0;
      
      for (let i = 0; i < layers.length; i++) {
        const layerPos = layers[i].indexOf(eventId);
        if (layerPos !== -1) {
          layerIndex = i;
          positionInLayer = layerPos;
          break;
        }
      }

      const x = layerIndex * 250 + 100;
      const y = positionInLayer * 150 + 100;

      // Récupérer les dates depuis l'API
      let dateTot = 0;
      let dateTard = 0;

      if (eventId === "START") {
        dateTot = result?.dateTot?.["debut"] || result?.dateTot?.["START"] || 0;
        dateTard = result?.dateTard?.["debut"] || result?.dateTard?.["START"] || 0;
      } else if (eventId === "END") {
        dateTot = result?.dateTot?.["fin"] || result?.dateTot?.["END"] || 0;
        dateTard = result?.dateTard?.["fin"] || result?.dateTard?.["END"] || 0;
      } else {
        // Chercher la tâche dans les résultats
        dateTot = result?.dateTot?.[eventId] || 0;
        dateTard = result?.dateTard?.[eventId] || 0;
        
        // Si pas trouvé directement, chercher dans les clés qui contiennent le nom
        if (dateTot === 0 && result?.dateTot) {
          const matchingKey = Object.keys(result.dateTot).find(key => 
            key.includes(eventId) || eventId.includes(key)
          );
          if (matchingKey) {
            dateTot = result.dateTot[matchingKey];
          }
        }
        
        if (dateTard === 0 && result?.dateTard) {
          const matchingKey = Object.keys(result.dateTard).find(key => 
            key.includes(eventId) || eventId.includes(key)
          );
          if (matchingKey) {
            dateTard = result.dateTard[matchingKey];
          }
        }
      }

      return {
        id: eventId,
        data: {
          label: (
            <div style={{
              fontSize: 10,
              textAlign: "center",
              padding: "4px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center"
            }}>
              <div style={{ fontWeight: "bold", marginBottom: 4 }}>
                {eventId === "START" ? "DÉBUT" : eventId === "END" ? "FIN" : eventId}
              </div>
              <div style={{ fontSize: 15 }}>
                <div>Tôt: {dateTot}</div>
                <div>Tard: {dateTard}</div>
              </div>
            </div>
          ),
        },
        position: { x, y },
        style: {
          background: eventId === "START" ? "#10b981" :
                      eventId === "END" ? "#3b82f6" : "#f1f5f9",
          border: `2px solid ${
            eventId === "START" ? "#047857" :
            eventId === "END" ? "#1e40af" : "#475569"
          }`,
          borderRadius: "50%",
          padding: 0,
          width: nodeWidth,
          height: nodeHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      };
    });

    console.log("Generated nodes:", eventNodes);
    console.log("Generated edges:", taskEdges);

    setNodes(eventNodes);
    setEdges(taskEdges);
  };

  return (
  <div className="p-4">
        <div className="max-w-3xl mx-auto">
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* En-tête avec gradient */}
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                {editingTask !== null ? (
                  <Edit3 className="w-6 h-6" />
                ) : (
                  <Plus className="w-6 h-6" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold">
                  {editingTask !== null ? "Modifier la tâche" : "Nouvelle tâche"}
                </h2>
                <p className="text-blue-100 text-sm">
                  {editingTask !== null 
                    ? "Modifiez les informations de votre tâche"
                    : "Ajoutez une nouvelle tâche à votre projet"
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Formulaire */}
          <div className="p-6 space-y-6">
            {/* Nom de la tâche */}
            <div className="group">
              <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-2">
                <Target className="w-4 h-4 text-blue-500" />
                <span>Nom de la tâche</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="ex: A"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white group-hover:border-gray-400"
                />
                <Sparkles className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
            </div>

            {/* Durée */}
            <div className="group">
              <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-2">
                <Clock className="w-4 h-4 text-green-500" />
                <span>Durée estimée</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="ex: 5"
                  value={duree}
                  onChange={(e) => setDuree(e.target.value)}
                  min={1}
                  className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white group-hover:border-gray-400"
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-green-500 transition-colors text-sm font-medium">
                  j
                </div>
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                  jours
                </div>
              </div>
            </div>

            {/* Grille pour prédécesseurs et successeurs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Prédécesseurs */}
              <div className="group">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-2">
                  <ArrowRight className="w-4 h-4 text-orange-500 rotate-180" />
                  <span>Prédécesseurs</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ex: A, B, C"
                    value={preced}
                    onChange={(e) => setPreced(e.target.value)}
                    className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white group-hover:border-gray-400"
                  />
                  <Users className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Tâches qui doivent être terminées avant</p>
              </div>

              {/* Successeurs */}
              <div className="group">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-2">
                  <ArrowRight className="w-4 h-4 text-purple-500" />
                  <span>Successeurs</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ex: D, E, F"
                    value={succ}
                    onChange={(e) => setSucc(e.target.value)}
                    className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white group-hover:border-gray-400"
                  />
                  <Users className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Tâches qui peuvent commencer après</p>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-col space-y-3 pt-4 border-t border-gray-100">
              <button 
                onClick={handleAddTask}
                className="group relative w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <div className="flex items-center justify-center space-x-2">
                  {editingTask !== null ? (
                    <>
                      <Edit3 className="w-5 h-5" />
                      <span>Modifier la tâche</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      <span>Ajouter la tâche</span>
                    </>
                  )}
                </div>
                <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </button>
              
              {editingTask !== null && (
                <button 
                  onClick={handleCancelEdit}
                  className="group w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-6 rounded-xl font-medium transition-all duration-200 border border-gray-300 hover:border-gray-400"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <X className="w-4 h-4" />
                    <span>Annuler la modification</span>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Message d'information si en mode édition */}
          {editingTask !== null && (
            <div className="mx-6 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-blue-100 rounded-full">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-blue-800 font-medium text-sm">Mode modification activé</p>
                  <p className="text-blue-600 text-xs mt-1">
                    Vous êtes en train de modifier une tâche existante. Les autres actions sont temporairement désactivées.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Tâches ajoutées</h2>
              <ul className="max-h-64 overflow-y-auto space-y-4">
                {tasks.map((t, i) => (
                  <li
                    key={i}
                    className="border border-gray-200 rounded-xl p-4 shadow-sm bg-gray-50 hover:bg-white transition duration-200"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="text-sm text-gray-700 leading-relaxed">
                        <span className="font-semibold text-indigo-600">{t.nom}</span> — 
                        durée : <span className="font-medium">{t.duree} j</span><br />
                        préc. : [{t.preced.join(", ")}] — succ. : [{t.succ.join(", ")}]
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditTask(i)}
                          className="px-3 py-1.5 text-sm rounded-lg bg-yellow-400 hover:bg-yellow-500 text-black font-medium transition"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDeleteTask(i)}
                          className="px-3 py-1.5 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Boutons globaux */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <button
                onClick={handleSendData}
                disabled={tasks.length === 0 || editingTask !== null}
                className="w-full py-4 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg 
                  bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white 
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Envoyer les données {tasks.length > 0 ? `(${tasks.length} tâches)` : ""}
              </button>

              <button
                onClick={handleCalculate}
                disabled={!dataSent || editingTask !== null}
                className="w-full py-4 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg 
                  bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white 
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Calculer le graphe CPM
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-red-600 font-bold">{error}</p>}
    </div>
    {result && (
        <div className="mt-8">
          <h3 className="font-semibold mb-4 text-lg">Graphe CPM :</h3>
          <div className="mb-4 p-4 bg-gray-100 rounded">
            <h4 className="font-medium mb-2">Légende :</h4>
            <div className="text-sm space-y-1">
              <div>• Les cercles représentent les événements (jalons)</div>
              <div>• Les flèches représentent les tâches avec leur durée</div>
              <div>• <span className="text-red-600 font-bold">Rouge et animé</span> = Chemin critique</div>
              <div>• Tôt = Date au plus tôt, Tard = Date au plus tard</div>
            </div>
          </div>
          <div style={{ height: 600, border: "1px solid #ccc", borderRadius: 8 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              attributionPosition="bottom-left"
            >
              <Background />
              <MiniMap />
              <Controls />
            </ReactFlow>
          </div>
          
          {result.critique && result.critique.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <h4 className="font-medium text-red-800 mb-2">Chemin critique :</h4>
              <p className="text-red-700">
                {result.critique.join(" → ")}
              </p>
            </div>
          )}
        </div>
      )}
    
  </div>
  );
}