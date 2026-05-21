import { ReactNode, useEffect, useRef, useState } from "react";
import {
  FiBell,
  FiChevronRight,
  FiLogOut,
  FiMenu,
  FiShoppingBag,
  FiTruck,
  FiUpload,
  FiUsers,
  FiX,
} from "react-icons/fi";
import {
  MdAssignment,
  MdDashboard,
  MdLocalShipping,
  MdPayments,
  MdPeople,
  MdSettings,
} from "react-icons/md";
import { useLocation, useNavigate } from "react-router-dom";
import { ROLE_LABELS, useAuth, useNotifications } from "../hooks";

const LOGO_URL =
  "https://betongtaydo.com/wp-content/uploads/2024/06/Logo-Be-Tong-Tay-Do-xanh-duong-1024x1024.png";

interface LayoutProps {
  children: ReactNode;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface MenuItem {
  path: string;
  label: string;
  icon: ReactNode;
  roles: string[];
}

const MENU_SECTIONS: MenuSection[] = [
  {
    title: "Tổng quan",
    items: [
      {
        path: "/dashboard",
        label: "Tổng quan",
        icon: <MdDashboard />,
        roles: ["admin", "ke_toan", "dieu_phoi", "lanh_dao"],
      },
    ],
  },
  {
    title: "Kinh doanh",
    items: [
      {
        path: "/quan-ly/don-hang",
        label: "Quản lý đơn hàng",
        icon: <FiShoppingBag size={18} />,
        roles: ["admin", "ke_toan", "dieu_phoi"],
      },
      {
        path: "/khach-hang",
        label: "Khách hàng",
        icon: <MdPeople />,
        roles: ["admin", "ke_toan", "dieu_phoi"],
      },
    ],
  },
  {
    title: "Vận hành",
    items: [
      {
        path: "/dieu-phoi",
        label: "Điều phối",
        icon: <MdLocalShipping />,
        roles: ["admin", "dieu_phoi"],
      },
      {
        path: "/nghiem-thu",
        label: "Nghiệm thu",
        icon: <MdAssignment />,
        roles: ["admin", "ke_toan", "dieu_phoi"],
      },
    ],
  },
  {
    title: "Tài chính",
    items: [
      {
        path: "/thanh-toan",
        label: "Thanh toán",
        icon: <MdPayments />,
        roles: ["admin", "ke_toan"],
      },
      {
        path: "/cong-no",
        label: "Công nợ",
        icon: <MdPayments />,
        roles: ["admin", "ke_toan"],
      },
    ],
  },
  {
    title: "Quản trị hệ thống",
    items: [
      {
        path: "/quan-ly/nguoi-dung",
        label: "Người dùng",
        icon: <FiUsers size={18} />,
        roles: ["admin"],
      },
      {
        path: "/quan-ly/xe",
        label: "Phương tiện",
        icon: <FiTruck size={18} />,
        roles: ["admin"],
      },
      {
        path: "/quan-ly/tram-tron",
        label: "Trạm trộn",
        icon: <MdSettings />,
        roles: ["admin"],
      },
      {
        path: "/tai-len-danh-sach",
        label: "Tải lên danh sách",
        icon: <FiUpload size={18} />,
        roles: ["admin"],
      },
    ],
  },
];

export function Layout({ children }: LayoutProps) {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const navItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Notifications
  const vaiTro = user?.vaiTro || "";
  const { unreadCount, refreshUnreadCount, PopupContainer, currentPopupId } =
    useNotifications(vaiTro, user?.id);

  useEffect(() => {
    if (user?.id) {
      refreshUnreadCount();
    }
  }, [user?.id, refreshUnreadCount]);

  // Lắng nghe event từ NotificationsPage để cập nhật badge
  useEffect(() => {
    const handler = () => refreshUnreadCount();
    window.addEventListener("bttd:notifications-refresh", handler);
    return () =>
      window.removeEventListener("bttd:notifications-refresh", handler);
  }, [refreshUnreadCount]);

  useEffect(() => {
    const token = localStorage.getItem("bttd_token");
    if (!token) {
      navigate("/login");
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="layout-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const allMenuItems = MENU_SECTIONS.flatMap((s) => s.items);
  const currentItem = allMenuItems.find((m) => m.path === location.pathname);
  const pageTitle = currentItem?.label || "Bê Tông Tây Đô";

  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  return (
    <>
      <PopupContainer />
      <div className="app-layout">
        {sidebarCollapsed && (
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarCollapsed(false)}
          />
        )}

        <aside
          className={`sidebar ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
        >
          {/* Logo */}
          <div className="sidebar-logo">
            <a href="/">
              <img src={LOGO_URL} alt="Bê Tông Tây Đô" />
            </a>
            <div>
              <div className="sidebar-logo-text">Bê Tông Tây Đô</div>
              <div className="sidebar-logo-sub">Hệ thống quản lý</div>
            </div>
          </div>

          {/* Nav */}
          <nav className="sidebar-nav">
            {MENU_SECTIONS.map((section) => {
              const visibleItems = section.items.filter((item) =>
                item.roles.includes(vaiTro),
              );
              if (visibleItems.length === 0) return null;
              return (
                <div key={section.title} className="nav-section">
                  <div className="nav-section-title">{section.title}</div>
                  {visibleItems.map((item) => (
                    <div
                      key={item.path}
                      ref={(el) => {
                        navItemRefs.current[item.path] = el;
                      }}
                      className={`nav-item ${location.pathname === item.path ? "nav-item-active" : ""}`}
                      onClick={() => {
                        navigate(item.path);
                      }}
                      onMouseEnter={() => {
                        if (sidebarCollapsed) {
                          const el = navItemRefs.current[item.path];
                          if (el) {
                            const rect = el.getBoundingClientRect();
                            setTooltipPos({
                              top: rect.top + rect.height / 2,
                              left: rect.right + 8,
                            });
                          }
                          setHoveredItem(item.path);
                        }
                      }}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-label">{item.label}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </nav>

          {/* User footer */}
          <div className="sidebar-footer">
            <div
              className="user-info"
              onMouseEnter={() => {
                if (sidebarCollapsed) {
                  setHoveredItem("__user__");
                  const el = document.querySelector(
                    ".sidebar-collapsed .user-info",
                  ) as HTMLElement;
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    setTooltipPos({
                      top: rect.top + rect.height / 2,
                      left: rect.right + 8,
                    });
                  }
                }
              }}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <div className="user-avatar">
                {user?.hoTen?.charAt(0)?.toUpperCase()}
              </div>
              <div className="user-info-text">
                <div className="user-name">{user?.hoTen}</div>
                <div className="user-role">
                  {ROLE_LABELS[user?.vaiTro as keyof typeof ROLE_LABELS] ||
                    user?.vaiTro}
                </div>
              </div>
            </div>
            <button
              className="btn btn-secondary sidebar-logout-btn"
              onClick={logout}
              onMouseEnter={() => {
                if (sidebarCollapsed) {
                  setHoveredItem("__logout__");
                  const el = document.querySelector(
                    ".sidebar-collapsed .sidebar-logout-btn",
                  ) as HTMLElement;
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    setTooltipPos({
                      top: rect.top + rect.height / 2,
                      left: rect.right + 8,
                    });
                  }
                }
              }}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <FiLogOut /> <span>Đăng xuất</span>
            </button>
          </div>

          {/* Tooltip khi sidebar thu gọn */}
          {hoveredItem && (
            <div
              className="sidebar-tooltip"
              style={{
                top: tooltipPos.top,
                left: tooltipPos.left,
              }}
            >
              {hoveredItem === "__user__"
                ? user?.hoTen
                : hoveredItem === "__logout__"
                  ? "Đăng xuất"
                  : allMenuItems.find((m) => m.path === hoveredItem)?.label}
            </div>
          )}
        </aside>

        {/* Main */}
        <main
          className={`main-content ${sidebarCollapsed ? "main-content-collapsed" : ""}`}
        >
          <header className="header">
            <div className="header-left">
              <button
                className="header-hamburger"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {sidebarCollapsed ? <FiMenu /> : <FiX />}
              </button>
              <div className="header-title-group">
                <h1 className="header-title">{pageTitle}</h1>
                <div className="header-breadcrumb">
                  <span>Trang chủ</span>
                  <FiChevronRight size={12} />
                  <span>{pageTitle}</span>
                </div>
              </div>
            </div>
            <div className="header-right">
              <span className="header-date">{today}</span>

              {/* Bell icon */}
              <button
                className="header-bell-btn"
                onClick={() => navigate("/thong-bao")}
                title="Thông báo"
                aria-label="Thông báo"
              >
                <FiBell size={20} />
                {unreadCount > 0 && (
                  <span className="header-bell-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </header>

          <div className="page-content">{children}</div>
        </main>
      </div>
    </>
  );
}
