import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Film, Plus, Clock, ChevronRight, Users, Camera, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { projectApi, type Project } from "../api";

export default function ProjectDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await projectApi.getProjects();
      setProjects(data);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("zh-CN");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#111111]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
              <Film className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl">漫剧分镜项目</h1>
          </div>
          <Button
            className="bg-purple-600 hover:bg-purple-700"
            onClick={() => navigate("/import")}
          >
            <Plus className="w-4 h-4 mr-2" />
            新建项目
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="搜索项目..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#1a1a1a] border-gray-700 text-gray-100"
            />
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">加载中...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Film className="w-16 h-16 mx-auto mb-3 opacity-20" />
            <p className="text-sm">暂无项目</p>
            <p className="text-xs mt-1">点击右上角"新建项目"开始创建</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className="bg-[#141414] border-gray-800 hover:border-purple-500 transition-colors cursor-pointer"
                onClick={() => navigate(`/workspace?project=${project.id}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-lg">{project.name}</span>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </CardTitle>
                  <CardDescription className="text-gray-400 text-sm line-clamp-2">
                    {project.description || "暂无描述"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center p-2 bg-[#0a0a0a] rounded">
                      <div className="text-purple-400 font-medium">{project.chapter_count ?? 0}</div>
                      <div className="text-xs text-gray-500 mt-1">章节</div>
                    </div>
                    <div className="text-center p-2 bg-[#0a0a0a] rounded">
                      <div className="text-pink-400 font-medium">{project.scene_count ?? 0}</div>
                      <div className="text-xs text-gray-500 mt-1">场景</div>
                    </div>
                    <div className="text-center p-2 bg-[#0a0a0a] rounded">
                      <div className="text-blue-400 font-medium">{project.storyboard_count ?? 0}</div>
                      <div className="text-xs text-gray-500 mt-1">分镜</div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between border-t border-gray-800 pt-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(project.updated_at)}</span>
                  </div>
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/workspace?project=${project.id}`);
                    }}
                  >
                    继续编辑
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
